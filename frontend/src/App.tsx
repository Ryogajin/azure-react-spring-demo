import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

/**
 * メインアプリケーションコンポーネント
 * 
 * ルーティング設定:
 *   /login      → ログイン画面
 *   /dashboard  → メニュー画面（ダッシュボード）
 *   /           → ログイン画面にリダイレクト
 * 
 * basename: 環境変数 VITE_BASE_PATH に合わせてベースパスを設定
 *   - /dev/     → web1（開発用）
 *   - /client/  → web2（顧客確認用）
 */
function App() {
  // ログインユーザー情報をstateで管理
  const [user, setUser] = useState<{
    id: number;
    username: string;
    displayName: string;
    role: string;
  } | null>(null);

  // ViteのBASE_URL（= build時の --base）をRouterにも適用して
  // index.htmlのassetパスとRouter basenameを常に一致させる。
  const basePath = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '') || '/';

  return (
    <BrowserRouter basename={basePath}>
      <Routes>
        {/* ログイン画面 */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <LoginPage onLogin={setUser} />
            )
          }
        />

        {/* ダッシュボード（ログイン必須） */}
        <Route
          path="/dashboard"
          element={
            user ? (
              <DashboardPage user={user} onLogout={() => setUser(null)} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* デフォルトルート → ログイン画面へリダイレクト */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;