import { useState, useEffect } from 'react';
import { saveFile, listFiles } from '../api/files';
import type { FileSaveResult } from '../api/files';

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