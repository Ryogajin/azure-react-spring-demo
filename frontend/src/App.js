import { useEffect, useState } from "react";

function App() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    fetch("http://localhost:8080/api/hello")
      .then((r) => r.json())
      .then((d) => setMsg(d.message))
      .catch((e) => setMsg(String(e)));
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>{msg}</h1>
    </div>
  );
}

export default App;
