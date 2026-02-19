import { useState, useEffect } from 'react';
import type { HealthResponse } from "@gameswipe/shared";

function App() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health").then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()) as HealthResponse;
    }).then(setData).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>GameSwipe</h1>
      <p>Backend health check:</p>
      {error ? <pre>{error}</pre> : <pre>{data ? JSON.stringify(data, null, 2) : "Loading..."}</pre>}
    </div>
  );
}

export default App
