import { getToken } from "./auth";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...options, headers });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

export const api = {
  login: (username, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  listUsers: () => request("/api/users"),
  createUser: (u) =>
    request("/api/users", { method: "POST", body: JSON.stringify(u) }),
  updateUser: (id, u) =>
    request(`/api/users/${id}`, { method: "PUT", body: JSON.stringify(u) }),
  deleteUser: (id) => request(`/api/users/${id}`, { method: "DELETE" }),
  yahoo: () => request("/api/yahoo"),
  azureFilesTest: () => request("/api/azurefiles/test"),
};

