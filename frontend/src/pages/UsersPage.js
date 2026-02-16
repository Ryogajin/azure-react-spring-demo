import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
  });

  const load = async () => {
    setError("");
    try {
      const res = await api.listUsers();
      setUsers(res);
    } catch (e) {
      setError(e.message || String(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.createUser(form);
      setForm({ username: "", password: "", displayName: "" });
      await load();
    } catch (e2) {
      setError(e2.message || String(e2));
    }
  };

  const onUpdate = async (u) => {
    setError("");
    const displayName = prompt("表示名を入力（空なら変更なし）", u.displayName);
    if (displayName === null) return;
    const password = prompt("パスワードを入力（空なら変更なし）", "");
    if (password === null) return;
    try {
      await api.updateUser(u.id, { displayName, password });
      await load();
    } catch (e2) {
      setError(e2.message || String(e2));
    }
  };

  const onDelete = async (u) => {
    if (!window.confirm(`${u.username} を削除しますか？`)) return;
    setError("");
    try {
      await api.deleteUser(u.id);
      await load();
    } catch (e2) {
      setError(e2.message || String(e2));
    }
  };

  return (
    <div style={{ maxWidth: 820, margin: "40px auto", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>ユーザ管理</h2>
        <Link to="/menu">← メニューへ戻る</Link>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
        <div style={{ fontWeight: "bold" }}>ユーザ登録</div>
        <form onSubmit={onCreate} style={{ display: "grid", gap: 8 }}>
          <input
            placeholder="username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            style={{ padding: 10 }}
          />
          <input
            placeholder="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            style={{ padding: 10 }}
          />
          <input
            placeholder="displayName"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            style={{ padding: 10 }}
          />
          <button type="submit">登録</button>
        </form>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd" }}>
        <div style={{ fontWeight: "bold" }}>ユーザ一覧</div>
        <button onClick={load} style={{ marginTop: 8 }}>
          再読み込み
        </button>
        <table style={{ width: "100%", marginTop: 8 }}>
          <thead>
            <tr>
              <th align="left">username</th>
              <th align="left">displayName</th>
              <th align="left">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>
                  <button onClick={() => onUpdate(u)}>変更</button>{" "}
                  <button onClick={() => onDelete(u)}>削除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ color: "#666", fontSize: 12, marginTop: 8 }}>
          注: “変更” はプロンプト入力の簡易UIです（手順書用の最小実装）。
        </div>
      </div>

      {error ? (
        <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>
      ) : null}
    </div>
  );
}

