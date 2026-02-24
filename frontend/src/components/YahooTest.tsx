import { useState } from 'react';
import { fetchYahooTitle } from '../api/external';
import type { YahooResult } from '../api/external';

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