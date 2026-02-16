import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { setToken, setUser } from "../lib/auth";

export default function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("Admin1234!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username, password);
      setToken(res.token);
      setUser(res.user);
      nav("/menu");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24 }}>
      <h2>ログイン</h2>
      <form onSubmit={onSubmit}>
        <div style={{ marginTop: 12 }}>
          <div>ユーザ名</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ width: "100%", padding: 10 }}
            autoComplete="username"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <div>パスワード</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 10 }}
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: 16, width: "100%", padding: 12 }}
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        初期ユーザ: admin / Admin1234!（バックエンド起動時に自動作成）
      </div>
    </div>
  );
}

