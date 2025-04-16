import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { initializeApp } from 'firebase/app'
import { getFirestore, collection, doc, setDoc, getDoc, query, where, getDocs, Timestamp, DocumentData } from 'firebase/firestore'

// データ保存先のディレクトリ名 (ローカルストレージ用、バックアップとして保持)
const DATA_DIR = 'coding-activity-data'

// Firebaseの設定
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * イベントを保存する
 * @param event 保存するイベントオブジェクト
 */
export async function storeEvent(event: any): Promise<void> {
  try {
    // 現在の日付を取得
    const date = new Date()
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
    
    // イベントにタイムスタンプを追加
    event.timestamp = Timestamp.fromDate(date)
    
    // Firestoreのコレクションとドキュメント参照を作成
    const eventsCollectionRef = collection(db, 'coding-activity-events')
    const dateDocRef = doc(eventsCollectionRef, dateString)
    
    // 既存のデータを取得
    const docSnap = await getDoc(dateDocRef)
    let events: any[] = []
    
    if (docSnap.exists()) {
      events = docSnap.data().events || []
    }
    
    // 新しいイベントを追加
    events.push(event)
    
    // ドキュメントに書き込み
    await setDoc(dateDocRef, { events: events }, { merge: true })
    
    // バックアップとしてローカルにも保存
    await storeEventLocally(event, dateString)
    
    console.log(`イベントを保存しました: ${event.type}`)
  } catch (error) {
    console.error('イベント保存中にエラーが発生しました:', error)
    vscode.window.showErrorMessage('コーディング活動の記録中にエラーが発生しました')
    
    // エラー時はローカルにバックアップ
    const date = new Date()
    const dateString = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
    await storeEventLocally(event, dateString)
  }
}

/**
 * イベントをローカルに保存する (バックアップとして)
 * @param event 保存するイベント
 * @param dateString 日付文字列 (YYYY-MM-DD)
 */
async function storeEventLocally(event: any, dateString: string): Promise<void> {
  try {
    // 保存先ディレクトリの確認と作成
    const storageDir = await ensureStorageDirectory()
    
    // 日付ごとのファイル名を生成（YYYY-MM-DD.json）
    const fileName = `${dateString}.json`
    const filePath = path.join(storageDir, fileName)
    
    // 既存のデータを読み込み、新しいイベントを追加
    let events: any[] = []
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8')
      events = JSON.parse(fileContent)
    }
    
    events.push(event)
    
    // ファイルに書き込み
    fs.writeFileSync(filePath, JSON.stringify(events, null, 2), 'utf8')
  } catch (error) {
    console.error('ローカルバックアップ保存中にエラーが発生しました:', error)
  }
}

/**
 * データ保存用のディレクトリを確保
 * @returns データ保存先ディレクトリのパス
 */
async function ensureStorageDirectory(): Promise<string> {
  // 拡張機能のグローバルストレージパスを取得
  const context = await getExtensionContext()
  const storageDir = path.join(context.globalStoragePath, DATA_DIR)
  
  // ディレクトリが存在しない場合は作成
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true })
  }
  
  return storageDir
}

/**
 * 拡張機能のコンテキストを取得（シングルトンパターン）
 */
let extensionContext: vscode.ExtensionContext | null = null

export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionContext = context
}

async function getExtensionContext(): Promise<vscode.ExtensionContext> {
  if (!extensionContext) {
    throw new Error('Extension context not initialized')
  }
  return extensionContext
}

/**
 * 特定の期間のイベントデータを取得
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns イベントの配列
 */
export async function getEventsInRange(startDate: Date, endDate: Date): Promise<any[]> {
  try {
    // Firestoreからデータを取得
    const result: any[] = []
    const eventsCollectionRef = collection(db, 'coding-activity-events')
    
    // 日付の範囲内のドキュメントを処理
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      const dateString = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}`
      const dateDocRef = doc(eventsCollectionRef, dateString)
      
      const docSnap = await getDoc(dateDocRef)
      if (docSnap.exists()) {
        const data = docSnap.data()
        if (data.events && Array.isArray(data.events)) {
          result.push(...data.events)
        }
      }
      
      // 次の日へ
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return result
  } catch (error) {
    console.error('Firestoreからのデータ取得中にエラーが発生しました:', error)
    
    // エラー時はローカルのバックアップから取得
    return getEventsFromLocalBackup(startDate, endDate)
  }
}

/**
 * ローカルバックアップから特定の期間のイベントデータを取得
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns イベントの配列
 */
async function getEventsFromLocalBackup(startDate: Date, endDate: Date): Promise<any[]> {
  const storageDir = await ensureStorageDirectory()
  const result: any[] = []
  
  // 日付の範囲内のファイルを処理
  const currentDate = new Date(startDate)
  while (currentDate <= endDate) {
    const fileName = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}-${currentDate.getDate().toString().padStart(2, '0')}.json`
    const filePath = path.join(storageDir, fileName)
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8')
      const events = JSON.parse(fileContent)
      result.push(...events)
    }
    
    // 次の日へ
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return result
}