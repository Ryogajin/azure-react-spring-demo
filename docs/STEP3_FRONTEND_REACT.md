# Step 3: フロントエンド実装 (React + Vite)

## 概要
React + Viteベースのフロントエンドアプリケーションを実装します。
App Gatewayのパスベースルーティング（`/dev`、`/client`）に対応するため、
ベースパスを環境変数で切り替え可能にします。

---

## 3.1 プロジェクト初期化（Viteで新規作成）

既存のCreate React Appプロジェクトを置き換えるため、frontendディレクトリを再作成します。

```bash
# 既存のfrontendディレクトリをバックアップ
mv frontend frontend_old

# Vite + React + TypeScriptでプロジェクトを新規作成
npm create vite@latest frontend -- --template react-ts

# frontendディレクトリに移動
cd frontend

# 依存関係をインストール
npm install

# 追加パッケージのインストール
# axios: HTTP通信ライブラリ（API連携用）
# react-router-dom: SPA用ルーティング
npm install axios react-router-dom
```

---

## 3.2 vite.config.ts（ベースパス設定）

App Gatewayのパスベースルーティングに対応するため、
ビルド時にベースパスを設定します。

ファイルパス: `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
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
export default defineConfig({
  plugins: [react()],

  // ベースパス設定
  // 環境変数 VITE_BASE_PATH が設定されていればそれを使用
  // 設定されていなければルート(/)を使用
  base: process.env.VITE_BASE_PATH || '/',

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
})
```

---

## 3.3 環境変数ファイル

### .env.development（ローカル開発用）
ファイルパス: `frontend/.env.development`

```
# ローカル開発用の環境変数
# APIベースURL（ローカルのSpring Boot）
VITE_API_BASE_URL=http://localhost:8080

# ベースパス（ローカルではルート）
VITE_BASE_PATH=/

# 環境名（画面表示用）
VITE_ENV_NAME=ローカル開発
```

### .env.production.dev（開発用VM: web1向けビルド）
ファイルパス: `frontend/.env.production.dev`

```
# 開発用VM（web1）向けの環境変数
# APIベースURL（バックエンドVMのPrivate IP:8080）
VITE_API_BASE_URL=http://172.16.2.4:8080

# ベースパス（App Gateway経由で /dev/ として配信される）
VITE_BASE_PATH=/dev/

# 環境名（画面に「開発環境」と表示される）
VITE_ENV_NAME=開発環境
```

### .env.production.client（顧客確認用VM: web2向けビルド）
ファイルパス: `frontend/.env.production.client`

```
# 顧客確認用VM（web2）向けの環境変数
# APIベースURL（バックエンドVMのPrivate IP:8080）
VITE_API_BASE_URL=http://172.16.2.4:8080

# ベースパス（App Gateway経由で /client/ として配信される）
VITE_BASE_PATH=/client/

# 環境名（画面に「顧客確認環境」と表示される）
VITE_ENV_NAME=顧客確認環境
```

---

## 3.4 API通信モジュール

### api.ts
ファイルパス: `frontend/src/api/api.ts`

```typescript
import axios, { AxiosError } from 'axios';

/**
 * Axiosインスタンスの作成
 * 全APIリクエストに共通の設定を適用する
 * 
 * baseURL: 環境変数 VITE_API_BASE_URL から取得
 *   - ローカル開発時: http://localhost:8080
 *   - VM配置時: http://172.16.2.4:8080（バックエンドVM）
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080',
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
  (response) => response,

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
```

### auth.ts
ファイルパス: `frontend/src/api/auth.ts`

```typescript
import api from './api';

/**
 * ログインAPI型定義
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  } | null;
}

/**
 * ログインAPIを呼び出す
 * 
 * @param username ユーザー名
 * @param password パスワード
 * @returns ログインレスポンス
 */
export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/api/auth/login', {
    username,
    password,
  });
  return response.data;
};
```

### users.ts
	ファイルパス: `frontend/src/api/users.ts`

```typescript
import api from './api';

/**
 * ユーザー型定義
 */
export interface User {
  id: number;
  username: string;
  password?: string;
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ユーザーリクエスト型定義
 */
export interface UserRequest {
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: string;
}

/**
 * APIレスポンスの汎用型
 */
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * ユーザー一覧を取得する
 */
export const getUsers = async (): Promise<User[]> => {
  const response = await api.get<ApiResponse<User[]>>('/api/users');
  return response.data.data;
};

/**
 * ユーザーを新規登録する
 */
export const createUser = async (user: UserRequest): Promise<User> => {
  const response = await api.post<ApiResponse<User>>('/api/users', user);
  return response.data.data;
};

/**
 * ユーザー情報を更新する
 */
export const updateUser = async (id: number, user: UserRequest): Promise<User> => {
  const response = await api.put<ApiResponse<User>>(`/api/users/${id}`, user);
  return response.data.data;
};

/**
 * ユーザーを削除する
 */
export const deleteUser = async (id: number): Promise<void> => {
  await api.delete(`/api/users/${id}`);
};
```

### external.ts
ファイルパス: `frontend/src/api/external.ts`

```typescript
import api from './api';

/**
 * Yahoo取得結果の型定義
 */
export interface YahooResult {
  statusCode: string;
  title: string;
  message: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * Yahoo! JAPANのタイトルを取得する（外部接続テスト）
 * Backend → NAT Gateway → Internet → Yahoo
 */
export const fetchYahooTitle = async (): Promise<YahooResult> => {
  const response = await api.get<ApiResponse<YahooResult>>('/api/external/yahoo');
  return response.data.data;
};
```

### files.ts
ファイルパス: `frontend/src/api/files.ts`

```typescript
import api from './api';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/**
 * ファイル保存結果の型定義
 */
export interface FileSaveResult {
  fileName: string;
  filePath: string;
  message: string;
}

/**
 * テキストファイルをAzure Filesに保存する
 * 
 * @param fileName ファイル名（拡張子なし）
 * @param content ファイル内容
 */
export const saveFile = async (fileName: string, content: string): Promise<FileSaveResult> => {
  const response = await api.post<ApiResponse<FileSaveResult>>('/api/files', {
    fileName,
    content,
  });
  return response.data.data;
};

/**
 * Azure Files上のファイル一覧を取得する
 */
export const listFiles = async (): Promise<string[]> => {
  const response = await api.get<ApiResponse<string[]>>('/api/files');
  return response.data.data;
};
```

---

## 3.5 画面コンポーネント

### App.tsx（メインルーター）
ファイルパス: `frontend/src/App.tsx`

```tsx
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

  // ベースパスを環境変数から取得（末尾のスラッシュを除去してReact Routerに渡す）
  const basePath = (import.meta.env.VITE_BASE_PATH || '/').replace(/\/+$/, '') || '/';

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
```

### LoginPage.tsx（ログイン画面）
ファイルパス: `frontend/src/pages/LoginPage.tsx`

```tsx
import { useState } from 'react';
import { login } from '../api/auth';

/**
 * ログインページコンポーネント
 * 
 * ユーザー名とパスワードを入力し、バックエンドAPIで認証を行う
 * 認証成功時はダッシュボード画面に遷移
 */
interface LoginPageProps {
  onLogin: (user: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  }) => void;
}

function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 環境名を表示（どのVMにアクセスしているか識別用）
  const envName = import.meta.env.VITE_ENV_NAME || 'ローカル';

  /**
   * ログインフォーム送信ハンドラー
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success && result.data) {
        onLogin(result.data);
      } else {
        setError(result.message || 'ログインに失敗しました');
      }
    } catch (err: any) {
      // エラー種別に応じたメッセージを表示
      if (err.response) {
        setError(err.response.data?.message || 'ログインに失敗しました');
      } else if (err.request) {
        setError('サーバーに接続できません。バックエンドAPIの起動状態を確認してください。');
      } else {
        setError('予期しないエラーが発生しました: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* 環境名バッジ */}
        <div style={styles.envBadge}>{envName}</div>

        <h1 style={styles.title}>計量システム</h1>
        <p style={styles.subtitle}>ログイン</p>

        {/* エラーメッセージ表示 */}
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>ユーザー名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder="ユーザー名を入力"
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="パスワードを入力"
              required
            />
          </div>

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}

/** インラインスタイル定義 */
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f0f2f5',
    fontFamily: "'Segoe UI', 'Hiragino Sans', sans-serif",
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
    position: 'relative',
  },
  envBadge: {
    position: 'absolute',
    top: '-12px',
    right: '20px',
    backgroundColor: '#1890ff',
    color: '#fff',
    padding: '4px 16px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '4px',
    fontSize: '24px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#888',
    marginBottom: '24px',
    fontSize: '14px',
  },
  error: {
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '16px',
    color: '#ff4d4f',
    fontSize: '14px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: '600',
    color: '#333',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
  },
};

export default LoginPage;
```

### DashboardPage.tsx（メニュー画面/ダッシュボード）
ファイルパス: `frontend/src/pages/DashboardPage.tsx`

```tsx
import { useState } from 'react';
import UserManagement from '../components/UserManagement';
import YahooTest from '../components/YahooTest';
import FileManager from '../components/FileManager';

/**
 * ダッシュボードページ
 * ログイン後のメイン画面。3つの機能タブを切り替えて使用する
 * 
 * タブ:
 *   1. ユーザー管理 - CRUD操作
 *   2. 外部接続テスト - Yahoo取得
 *   3. Azure Files操作 - ファイル保存
 */
interface DashboardProps {
  user: {
    id: number;
    username: string;
    displayName: string;
    role: string;
  };
  onLogout: () => void;
}

function DashboardPage({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'yahoo' | 'files'>('users');
  const envName = import.meta.env.VITE_ENV_NAME || 'ローカル';

  return (
    <div style={styles.container}>
      {/* ヘッダー */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>計量システム</h1>
          <span style={styles.envTag}>{envName}</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userName}>{user.displayName} ({user.role})</span>
          <button onClick={onLogout} style={styles.logoutButton}>
            ログアウト
          </button>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav style={styles.tabNav}>
        <button
          onClick={() => setActiveTab('users')}
          style={activeTab === 'users' ? styles.tabActive : styles.tab}
        >
          ① ユーザー管理
        </button>
        <button
          onClick={() => setActiveTab('yahoo')}
          style={activeTab === 'yahoo' ? styles.tabActive : styles.tab}
        >
          ② 外部接続テスト
        </button>
        <button
          onClick={() => setActiveTab('files')}
          style={activeTab === 'files' ? styles.tabActive : styles.tab}
        >
          ③ Azure Files操作
        </button>
      </nav>

      {/* タブコンテンツ */}
      <main style={styles.main}>
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'yahoo' && <YahooTest />}
        {activeTab === 'files' && <FileManager />}
      </main>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f0f2f5',
    fontFamily: "'Segoe UI', 'Hiragino Sans', sans-serif",
  },
  header: {
    backgroundColor: '#001529',
    color: '#fff',
    padding: '12px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerTitle: {
    fontSize: '20px',
    margin: 0,
  },
  envTag: {
    backgroundColor: '#1890ff',
    padding: '2px 10px',
    borderRadius: '10px',
    fontSize: '12px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userName: {
    fontSize: '14px',
  },
  logoutButton: {
    backgroundColor: 'transparent',
    border: '1px solid #fff',
    color: '#fff',
    padding: '6px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  tabNav: {
    display: 'flex',
    gap: '0',
    backgroundColor: '#fff',
    borderBottom: '2px solid #e8e8e8',
    padding: '0 24px',
  },
  tab: {
    padding: '14px 24px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: '-2px',
  },
  tabActive: {
    padding: '14px 24px',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    color: '#1890ff',
    borderBottom: '2px solid #1890ff',
    marginBottom: '-2px',
  },
  main: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
};

export default DashboardPage;
```

### UserManagement.tsx（ユーザー管理コンポーネント）
ファイルパス: `frontend/src/components/UserManagement.tsx`

```tsx
import { useState, useEffect } from 'react';
import { User, UserRequest, getUsers, createUser, updateUser, deleteUser } from '../api/users';

/**
 * ユーザー管理コンポーネント
 * ユーザーの一覧表示・登録・更新・削除（CRUD）を行う
 */
function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // フォームの入力値
  const [form, setForm] = useState<UserRequest>({
    username: '',
    password: '',
    displayName: '',
    email: '',
    role: 'user',
  });

  /**
   * コンポーネントマウント時にユーザー一覧を取得
   */
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * ユーザー一覧をAPIから取得
   */
  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err: any) {
      setError('ユーザー一覧の取得に失敗しました。DB接続を確認してください。');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 新規登録フォームを表示
   */
  const handleNew = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', displayName: '', email: '', role: 'user' });
    setShowForm(true);
  };

  /**
   * 編集フォームを表示（既存ユーザーの情報をフォームにセット）
   */
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      username: user.username,
      password: '',
      displayName: user.displayName,
      email: user.email,
      role: user.role,
    });
    setShowForm(true);
  };

  /**
   * フォーム送信（新規登録 or 更新）
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingUser) {
        await updateUser(editingUser.id, form);
      } else {
        await createUser(form);
      }
      setShowForm(false);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || '保存に失敗しました');
    }
  };

  /**
   * ユーザー削除
   */
  const handleDelete = async (id: number) => {
    if (!window.confirm('このユーザーを削除しますか？')) return;
    try {
      await deleteUser(id);
      loadUsers();
    } catch (err: any) {
      setError(err.response?.data?.message || '削除に失敗しました');
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.titleRow}>
        <h2 style={styles.title}>ユーザー管理</h2>
        <button onClick={handleNew} style={styles.addButton}>
          + 新規登録
        </button>
      </div>

      {/* エラー表示 */}
      {error && <div style={styles.error}>{error}</div>}

      {/* 登録/編集フォーム */}
      {showForm && (
        <div style={styles.formCard}>
          <h3>{editingUser ? 'ユーザー編集' : 'ユーザー新規登録'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={styles.formGrid}>
              <div>
                <label style={styles.label}>ユーザー名</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>パスワード</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  style={styles.input}
                  required={!editingUser}
                  placeholder={editingUser ? '変更しない場合は空欄' : ''}
                />
              </div>
              <div>
                <label style={styles.label}>表示名</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div>
                <label style={styles.label}>メールアドレス</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>役割</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  style={styles.input}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <div style={styles.formActions}>
              <button type="submit" style={styles.saveButton}>保存</button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={styles.cancelButton}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ユーザー一覧テーブル */}
      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr style={styles.tableHeader}>
              <th style={styles.th}>ID</th>
              <th style={styles.th}>ユーザー名</th>
              <th style={styles.th}>表示名</th>
              <th style={styles.th}>メール</th>
              <th style={styles.th}>役割</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={styles.tableRow}>
                <td style={styles.td}>{u.id}</td>
                <td style={styles.td}>{u.username}</td>
                <td style={styles.td}>{u.displayName}</td>
                <td style={styles.td}>{u.email}</td>
                <td style={styles.td}>{u.role}</td>
                <td style={styles.td}>
                  <button
                    onClick={() => handleEdit(u)}
                    style={styles.editBtn}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(u.id)}
                    style={styles.deleteBtn}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>
                  ユーザーが登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  title: { margin: 0, fontSize: '18px', color: '#333' },
  addButton: {
    backgroundColor: '#52c41a',
    color: '#fff',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  error: {
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '16px',
    color: '#ff4d4f',
  },
  formCard: {
    border: '1px solid #e8e8e8',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
    backgroundColor: '#fafafa',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  label: { display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px' },
  input: {
    width: '100%',
    padding: '8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  formActions: { marginTop: '16px', display: 'flex', gap: '8px' },
  saveButton: {
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    padding: '8px 24px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cancelButton: {
    backgroundColor: '#fff',
    border: '1px solid #d9d9d9',
    padding: '8px 24px',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeader: { backgroundColor: '#fafafa' },
  th: {
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #e8e8e8',
    fontSize: '13px',
    fontWeight: '600',
  },
  tableRow: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 12px', fontSize: '14px' },
  editBtn: {
    backgroundColor: '#1890ff',
    color: '#fff',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '3px',
    cursor: 'pointer',
    marginRight: '6px',
    fontSize: '12px',
  },
  deleteBtn: {
    backgroundColor: '#ff4d4f',
    color: '#fff',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default UserManagement;
```

### YahooTest.tsx（外部接続テストコンポーネント）
ファイルパス: `frontend/src/components/YahooTest.tsx`

```tsx
import { useState } from 'react';
import { fetchYahooTitle, YahooResult } from '../api/external';

/**
 * 外部接続テストコンポーネント
 * ボタンを押すとバックエンドがNAT Gateway経由でYahoo! JAPANにアクセスし、
 * HTMLのタイトルを取得して表示する
 * 
 * 通信経路:
 *   ブラウザ → App Gateway → IIS → Spring Boot → NAT Gateway → Yahoo
 */
function YahooTest() {
  const [result, setResult] = useState<YahooResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFetch = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const data = await fetchYahooTitle();
      setResult(data);
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.request) {
        setError('バックエンドAPIに接続できません。Spring Bootの起動状態を確認してください。');
      } else {
        setError('外部接続テストに失敗しました: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>外部接続テスト（Yahoo! JAPAN）</h2>
      <p style={styles.description}>
        「取得」ボタンを押すと、バックエンドがNAT Gateway経由でYahoo! JAPANにアクセスし、
        ページのタイトルを取得します。正常に取得できれば、NAT Gatewayの設定が正しいことを確認できます。
      </p>

      <div style={styles.flowDiagram}>
        <span style={styles.flowStep}>ブラウザ</span>
        <span style={styles.flowArrow}>→</span>
        <span style={styles.flowStep}>App Gateway</span>
        <span style={styles.flowArrow}>→</span>
        <span style={styles.flowStep}>Backend API</span>
        <span style={styles.flowArrow}>→</span>
        <span style={styles.flowStep}>NAT Gateway</span>
        <span style={styles.flowArrow}>→</span>
        <span style={styles.flowStep}>Yahoo!</span>
      </div>

      <button
        onClick={handleFetch}
        disabled={loading}
        style={styles.button}
      >
        {loading ? '取得中...' : 'Yahoo! JAPANのタイトルを取得'}
      </button>

      {/* エラー表示 */}
      {error && <div style={styles.error}>{error}</div>}

      {/* 結果表示 */}
      {result && (
        <div style={styles.resultCard}>
          <h3 style={styles.resultTitle}>取得結果</h3>
          <table style={styles.resultTable}>
            <tbody>
              <tr>
                <td style={styles.resultLabel}>ステータスコード</td>
                <td style={styles.resultValue}>{result.statusCode}</td>
              </tr>
              <tr>
                <td style={styles.resultLabel}>ページタイトル</td>
                <td style={styles.resultValue}>{result.title}</td>
              </tr>
              <tr>
                <td style={styles.resultLabel}>結果メッセージ</td>
                <td style={styles.resultValue}>{result.message}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  title: { margin: '0 0 8px', fontSize: '18px', color: '#333' },
  description: { color: '#666', fontSize: '14px', marginBottom: '20px' },
  flowDiagram: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    backgroundColor: '#f6f8fa',
    borderRadius: '8px',
    marginBottom: '20px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  flowStep: {
    backgroundColor: '#1890ff',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: '600',
  },
  flowArrow: { color: '#999', fontSize: '18px' },
  button: {
    backgroundColor: '#faad14',
    color: '#fff',
    border: 'none',
    padding: '12px 32px',
    borderRadius: '6px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    padding: '10px',
    marginTop: '16px',
    color: '#ff4d4f',
  },
  resultCard: {
    marginTop: '20px',
    border: '1px solid #d9f7be',
    borderRadius: '8px',
    padding: '16px',
    backgroundColor: '#f6ffed',
  },
  resultTitle: { margin: '0 0 12px', color: '#52c41a', fontSize: '16px' },
  resultTable: { width: '100%', borderCollapse: 'collapse' },
  resultLabel: {
    padding: '8px',
    fontWeight: '600',
    color: '#333',
    borderBottom: '1px solid #e8e8e8',
    width: '160px',
  },
  resultValue: {
    padding: '8px',
    color: '#666',
    borderBottom: '1px solid #e8e8e8',
  },
};

export default YahooTest;
```

### FileManager.tsx（Azure Filesファイル操作コンポーネント）
ファイルパス: `frontend/src/components/FileManager.tsx`

```tsx
import { useState, useEffect } from 'react';
import { saveFile, listFiles, FileSaveResult } from '../api/files';

/**
 * Azure Filesファイル操作コンポーネント
 * テキスト入力欄と保存ボタンを提供し、
 * バックエンドAPI経由でAzure Files（SMBマウント）にテキストファイルを保存する
 */
function FileManager() {
  const [fileName, setFileName] = useState('');
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<FileSaveResult | null>(null);
  const [error, setError] = useState('');

  /**
   * コンポーネントマウント時にファイル一覧を取得
   */
  useEffect(() => {
    loadFiles();
  }, []);

  /**
   * Azure Files上のファイル一覧を取得
   */
  const loadFiles = async () => {
    try {
      const data = await listFiles();
      setFiles(data);
    } catch (err: any) {
      console.error('ファイル一覧取得エラー:', err);
    }
  };

  /**
   * ファイル保存ハンドラー
   */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setResult(null);

    try {
      const data = await saveFile(fileName, content);
      setResult(data);
      setFileName('');
      setContent('');
      loadFiles(); // 一覧を再取得
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('ファイル保存に失敗しました。Azure Filesの接続を確認してください。');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <h2 style={styles.title}>Azure Files操作</h2>
      <p style={styles.description}>
        テキストを入力して「保存」ボタンを押すと、バックエンドAPI経由で
        Azure Files（SMBマウント）にテキストファイルが作成されます。
      </p>

      {/* エラー表示 */}
      {error && <div style={styles.error}>{error}</div>}

      {/* 保存成功メッセージ */}
      {result && (
        <div style={styles.success}>
          ファイルを保存しました: {result.fileName}
        </div>
      )}

      {/* ファイル保存フォーム */}
      <form onSubmit={handleSave} style={styles.form}>
        <div style={styles.formGroup}>
          <label style={styles.label}>ファイル名（拡張子は自動付与）</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="例: memo, report"
            style={styles.input}
            required
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>内容</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="保存するテキストを入力してください"
            style={styles.textarea}
            rows={6}
            required
          />
        </div>
        <button type="submit" disabled={saving} style={styles.saveButton}>
          {saving ? '保存中...' : 'Azure Filesに保存'}
        </button>
      </form>

      {/* ファイル一覧 */}
      <div style={styles.fileList}>
        <h3 style={styles.subtitle}>保存済みファイル一覧</h3>
        {files.length > 0 ? (
          <ul style={styles.list}>
            {files.map((file, idx) => (
              <li key={idx} style={styles.listItem}>{file}</li>
            ))}
          </ul>
        ) : (
          <p style={styles.noFiles}>ファイルがありません</p>
        )}
        <button onClick={loadFiles} style={styles.refreshButton}>
          一覧を更新
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  title: { margin: '0 0 8px', fontSize: '18px', color: '#333' },
  description: { color: '#666', fontSize: '14px', marginBottom: '20px' },
  error: {
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '16px',
    color: '#ff4d4f',
  },
  success: {
    backgroundColor: '#f6ffed',
    border: '1px solid #b7eb8f',
    borderRadius: '6px',
    padding: '10px',
    marginBottom: '16px',
    color: '#52c41a',
  },
  form: {
    border: '1px solid #e8e8e8',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '24px',
    backgroundColor: '#fafafa',
  },
  formGroup: { marginBottom: '12px' },
  label: { display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px' },
  input: {
    width: '100%',
    padding: '8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '8px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    resize: 'vertical',
  },
  saveButton: {
    backgroundColor: '#722ed1',
    color: '#fff',
    border: 'none',
    padding: '10px 28px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  fileList: {
    border: '1px solid #e8e8e8',
    borderRadius: '8px',
    padding: '16px',
  },
  subtitle: { margin: '0 0 12px', fontSize: '15px', color: '#333' },
  list: { listStyle: 'none', padding: 0, margin: 0 },
  listItem: {
    padding: '8px 12px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '14px',
    color: '#333',
  },
  noFiles: { color: '#999', fontSize: '14px' },
  refreshButton: {
    marginTop: '12px',
    backgroundColor: '#fff',
    border: '1px solid #d9d9d9',
    padding: '6px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
};

export default FileManager;
```

---

## 3.6 ビルド手順

### 開発用VM（web1）向けビルド

```bash
cd frontend

# 開発用VM向けの環境変数でビルド
# .env.production.dev を .env.production にコピーしてからビルド
cp .env.production.dev .env.production
npm run build

# dist/ フォルダに成果物が生成される
# これをweb1のIISに配置する
```

### 顧客確認用VM（web2）向けビルド

```bash
cd frontend

# 顧客確認用VM向けの環境変数でビルド
cp .env.production.client .env.production
npm run build

# dist/ フォルダに成果物が生成される
# これをweb2のIISに配置する
```

---

## 3.7 ディレクトリ構成（完成後）

```
frontend/
├── public/
├── src/
│   ├── api/
│   │   ├── api.ts          # Axiosインスタンス（共通設定）
│   │   ├── auth.ts         # ログインAPI
│   │   ├── users.ts        # ユーザーCRUD API
│   │   ├── external.ts     # 外部接続テストAPI
│   │   └── files.ts        # Azure Filesファイル操作API
│   ├── components/
│   │   ├── UserManagement.tsx   # ユーザー管理コンポーネント
│   │   ├── YahooTest.tsx        # 外部接続テスト
│   │   └── FileManager.tsx      # Azure Files操作
│   ├── pages/
│   │   ├── LoginPage.tsx        # ログイン画面
│   │   └── DashboardPage.tsx    # ダッシュボード画面
│   ├── App.tsx                  # メインルーター
│   └── main.tsx                 # エントリーポイント
├── .env.development             # ローカル開発用
├── .env.production.dev          # web1（開発用VM）向け
├── .env.production.client       # web2（顧客確認用VM）向け
├── vite.config.ts               # Vite設定
├── package.json
└── tsconfig.json
```
