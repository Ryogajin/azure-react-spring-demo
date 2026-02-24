import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Vite設定ファイル
 * 
 * 重要: App Gatewayのパスベースルーティングに対応するため、
 * ベースパスを環境変数 VITE_BASE_PATH で切り替える
 * 
 * - 開発用VM (web1): VITE_BASE_PATH=/dev/
 * - 顧客確認用VM (web2): VITE_BASE_PATH=/client/
 * - ローカル開発: VITE_BASE_PATH=/（デフォルト）
 */
export default defineConfig(({ mode }) => {
  // .env.production.dev / .env.production.client を mode 指定で読み込む
  const env = loadEnv(mode, process.cwd(), '')
  const basePath =
    mode === 'production.dev'
      ? '/dev/'
      : mode === 'production.client'
        ? '/client/'
        : (env.VITE_BASE_PATH || '/')

  return {
    plugins: [react()],

    // ベースパス設定
    // VITE_BASE_PATH が設定されていればそれを使用
    // 設定されていなければルート(/)を使用
    base: basePath,

    server: {
      // ローカル開発サーバーの設定
      port: 3000,
      // バックエンドAPIへのプロキシ設定（ローカル開発時用）
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },

    build: {
      // ビルド出力先
      outDir: 'dist',
      // ソースマップ生成（デバッグ用）
      sourcemap: false,
    },
  }
})