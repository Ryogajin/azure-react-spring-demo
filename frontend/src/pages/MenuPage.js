import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { clearToken, getUser } from "../lib/auth";

export default function MenuPage() {
  const nav = useNavigate();
  const user = getUser();
  const [yahoo, setYahoo] = useState(null);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState("");

  const logout = () => {
    clearToken();
    localStorage.removeItem("user");
    nav("/login");
  };

  const runYahoo = async () => {
    setError("");
    setYahoo(null);
    try {
      const res = await api.yahoo();
      setYahoo(res);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  const runFiles = async () => {
    setError("");
    setFiles(null);
    try {
      const res = await api.azureFilesTest();
      setFiles(res);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>メニュー</h2>
        <button onClick={logout}>ログアウト</button>
      </div>
      <div style={{ color: "#666" }}>
        ログインユーザ: {user?.username}（{user?.displayName}）
      </div>

      <div style={{ marginTop: 20, display: "grid", gap: 12 }}>
        <div style={{ padding: 12, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: "bold" }}>ユーザ管理</div>
          <div style={{ marginTop: 8 }}>
            <Link to="/users">ユーザ一覧 / 登録 / 変更 / 削除</Link>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: "bold" }}>
            Yahooの情報を取得（NATで外部疎通確認）
          </div>
          <button style={{ marginTop: 8 }} onClick={runYahoo}>
            取得する
          </button>
          {yahoo ? (
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(yahoo, null, 2)}
            </pre>
          ) : null}
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd" }}>
          <div style={{ fontWeight: "bold" }}>Azure Filesへの接続</div>
          <button style={{ marginTop: 8 }} onClick={runFiles}>
            テストする（書込/読込）
          </button>
          {files ? (
            <pre style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(files, null, 2)}
            </pre>
          ) : null}
        </div>

        {error ? <div style={{ color: "crimson" }}>{error}</div> : null}
      </div>
    </div>
  );
}

