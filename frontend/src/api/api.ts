import axios, { AxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

/**
 * Axiosインスタンスの作成
 * 全APIリクエストに共通の設定を適用する
 * 
 * baseURL:
 *   - 基本は空文字（同一オリジン）
 *   - 呼び出し側は `/api/...` を指定
 *   - 必要時のみ VITE_API_BASE_URL で上書き
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 15000,  // タイムアウト15秒
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * レスポンスインターセプター
 * 全APIレスポンスに対してエラーハンドリングを共通化する
 * エラー種別に応じた分かりやすいメッセージを生成
 */
api.interceptors.response.use(
  // 正常レスポンスはそのまま返す
  (response: AxiosResponse) => response,

  // エラーレスポンスのハンドリング
  (error: AxiosError) => {
    if (error.response) {
      // サーバーからのエラーレスポンス（4xx, 5xx）
      console.error(`APIエラー [${error.response.status}]:`, error.response.data);
    } else if (error.request) {
      // リクエストは送信されたがレスポンスがない
      // → バックエンドVM停止、ネットワーク遮断、NSG設定ミス等の可能性
      console.error('ネットワークエラー: バックエンドサーバーに接続できません', error.message);
    } else {
      // リクエスト作成時のエラー
      console.error('リクエストエラー:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;