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
        <div style={styles.headerInner}>
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
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav style={styles.tabNav}>
        <div style={styles.tabInner}>
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
        </div>
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
  },
  headerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
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
    backgroundColor: '#fff',
    borderBottom: '2px solid #e8e8e8',
    padding: '0 24px',
  },
  tabInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    gap: '0',
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