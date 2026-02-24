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
    padding: '24px',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '40px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '440px',
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