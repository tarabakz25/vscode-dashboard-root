import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { initializeApp, FirebaseApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, addDoc, getDoc, query, where, getDocs, Timestamp, DocumentData, Firestore } from 'firebase/firestore'

// データ保存先のディレクトリ名 (ローカルストレージ用、バックアップとして保持)
const DATA_DIR = 'coding-activity-data'

// Firebase設定ファイルのパス
const FIREBASE_CONFIG_PATH = path.join(__dirname, '..', 'firebase-config.json');

// Firebase設定用のインターフェース
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Firebaseアプリとデータベースのインスタンス
let app: FirebaseApp | null = null;
let db: Firestore | null = null;

/**
 * Firebaseの初期化 - 設定ファイルから読み込み
 */
export function initializeFirebase(): void {
  try {
    // 設定ファイルから読み込み
    let config: FirebaseConfig;
    
    if (fs.existsSync(FIREBASE_CONFIG_PATH)) {
      console.log('Firebase設定ファイルを読み込み:', FIREBASE_CONFIG_PATH);
      const configText = fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8');
      config = JSON.parse(configText);
    } else {
      // 設定ファイルがない場合はエラー
      const errorMessage = `Firebase設定ファイルが見つかりません: ${FIREBASE_CONFIG_PATH}`;
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      return;
    }
    
    // Firebaseアプリの初期化
    app = initializeApp(config);
    
    // Firestoreデータベースの取得
    db = getFirestore(app);
    
    console.log('Firebaseが正常に初期化されました');
  } catch (error) {
    console.error('Firebase初期化エラー:', error);
    vscode.window.showErrorMessage('Firebaseの初期化に失敗しました。設定ファイルを確認してください。');
  }
}

/**
 * ユーザー識別子を取得（またはローカルに保存されていなければ生成）
 */
export async function getUserId(): Promise<string> {
  const context = await getExtensionContext();
  let userId = await context.secrets.get('user_id');
  
  if (!userId) {
    // マシン情報とランダム値を組み合わせて一意のIDを生成
    userId = generateUUID();
    await context.secrets.store('user_id', userId);
    console.log('新しいユーザーIDを生成しました:', userId);
  }
  
  return userId;
}

/**
 * UUID生成関数
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * イベントを保存する
 * @param event 保存するイベントオブジェクト
 */
export async function storeEvent(event: any): Promise<void> {
  try {
    // Firebaseが初期化されているか確認
    if (!db) {
      console.error('Firestoreが初期化されていません');
      await storeEventLocally(event, getDateString());
      return;
    }

    // ユーザー識別子を取得
    const userId = await getUserId();
    
    // イベントデータの準備
    const date = new Date();
    const eventData = {
      event: event.type || event.subtype || 'unknown',
      file: event.data?.document || '',
      timestamp: date.toISOString(),
      duration: event.data?.idleDuration || 0,
      userId: userId  // ユーザーIDを含める
    };
    
    // Firestoreに保存
    try {
      // activity_logsコレクションに保存
      await addDoc(collection(db, 'activity_logs'), eventData);
      console.log(`イベントを保存しました: ${eventData.event} (ユーザー: ${userId})`);
    } catch (firestoreError) {
      console.error('Firestoreへの保存に失敗しました:', firestoreError);
      // バックアップとしてローカルに保存
      await storeEventLocally(event, getDateString());
    }
  } catch (error) {
    console.error('イベント保存中にエラーが発生しました:', error);
    vscode.window.showErrorMessage('コーディング活動の記録中にエラーが発生しました');
    
    // エラー時はローカルにバックアップ
    await storeEventLocally(event, getDateString());
  }
}

/**
 * GitHubアカウント情報をユーザーIDに紐付けてFirestoreに保存する
 * @param vscodeUserId VS Code 拡張機能のユーザーID
 * @param githubUsername GitHubのユーザー名
 * @param githubUserId GitHubの数値ID
 */
export async function linkGitHubAccountToUser(vscodeUserId: string, githubUsername: string, githubUserId: string): Promise<void> {
  if (!db) {
    console.error('Firestoreが初期化されていません。GitHubアカウント連携情報を保存できません。');
    // ここでエラーを投げるか、ユーザーに通知するか検討
    throw new Error('Firestore is not initialized.');
  }

  try {
    const userLinkRef = doc(db, 'userLinks', vscodeUserId); // 'userLinks' コレクションに、VS CodeユーザーIDをドキュメントIDとして保存
    await setDoc(userLinkRef, {
      githubUsername: githubUsername,
      githubUserId: githubUserId,
      linkedAt: Timestamp.now() // 連携した日時も保存
    }, { merge: true }); // 既に情報が存在する場合はマージ（更新）

    console.log(`ユーザー (${vscodeUserId}) のGitHubアカウント (${githubUsername}) 連携情報をFirestoreに保存しました。`);
  } catch (error) {
    console.error('FirestoreへのGitHub連携情報の保存に失敗しました:', error);
    // エラーハンドリング: 必要に応じてユーザーへの通知や再試行ロジックを追加
    throw error; // エラーを呼び出し元に伝える
  }
}

/**
 * 現在の日付文字列を取得
 */
function getDateString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

/**
 * イベントをローカルに保存する (バックアップとして)
 * @param event 保存するイベント
 * @param dateString 日付文字列 (YYYY-MM-DD)
 */
async function storeEventLocally(event: any, dateString: string): Promise<void> {
  try {
    // 保存先ディレクトリの確認と作成
    const storageDir = await ensureStorageDirectory();
    
    // 日付ごとのファイル名を生成（YYYY-MM-DD.json）
    const fileName = `${dateString}.json`;
    const filePath = path.join(storageDir, fileName);
    
    // 既存のデータを読み込み、新しいイベントを追加
    let events: any[] = [];
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      events = JSON.parse(fileContent);
    }
    
    events.push(event);
    
    // ファイルに書き込み
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8');
  } catch (error) {
    console.error('ローカルバックアップ保存中にエラーが発生しました:', error);
  }
}

/**
 * データ保存用のディレクトリを確保
 * @returns データ保存先ディレクトリのパス
 */
async function ensureStorageDirectory(): Promise<string> {
  // 拡張機能のグローバルストレージパスを取得
  const context = await getExtensionContext();
  const storageDir = path.join(context.globalStoragePath, DATA_DIR);
  
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  
  return storageDir;
}

/**
 * 拡張機能のコンテキストを取得（シングルトンパターン）
 */
let extensionContext: vscode.ExtensionContext | null = null;

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context;
}

async function getExtensionContext(): Promise<vscode.ExtensionContext> {
  if (!extensionContext) {
    throw new Error('Extension context not initialized');
  }
  return extensionContext;
}

/**
 * 特定の期間のイベントデータを取得
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns イベントの配列
 */
export async function getEventsInRange(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    // ユーザーIDを取得
    const userId = await getUserId();
    
    // Firebaseが初期化されているか確認
    if (!db) {
      console.error('Firestoreが初期化されていません');
      return getEventsFromLocalBackup(startDate, endDate);
    }
    
    // Firestoreからデータを取得
    const result: any[] = [];
    
    try {
      const eventsCollectionRef = collection(db, 'activity_logs');
      const startTimestamp = startDate.toISOString();
      const endTimestamp = endDate.toISOString();
      
      const q = query(
        eventsCollectionRef,
        where('userId', '==', userId),
        where('timestamp', '>=', startTimestamp),
        where('timestamp', '<=', endTimestamp)
      );
      
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        result.push(doc.data());
      });
      
      return result;
    } catch (firestoreError) {
      console.error('Firestoreからのデータ取得中にエラーが発生しました:', firestoreError);
      return getEventsFromLocalBackup(startDate, endDate);
    }
  } catch (error) {
    console.error('イベント取得中にエラーが発生しました:', error);
    
    // エラー時はローカルのバックアップから取得
    return getEventsFromLocalBackup(startDate, endDate);
  }
}

/**
 * ローカルバックアップから特定の期間のイベントデータを取得
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns イベントの配列
 */
async function getEventsFromLocalBackup(startDate: Date, endDate: Date): Promise<any[]> {
  const storageDir = await ensureStorageDirectory();
  const result: any[] = [];
  
  // 日付の範囲内のファイルを処理
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const fileName = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}.json`;
    const filePath = path.join(storageDir, fileName);
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const events = JSON.parse(fileContent);
      result.push(...events);
    }
    
    // 次の日へ
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return result;
}