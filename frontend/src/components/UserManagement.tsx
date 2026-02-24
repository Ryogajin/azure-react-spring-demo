import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import type { User, UserRequest } from '../api/users';

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