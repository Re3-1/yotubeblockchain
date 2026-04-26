import { useState } from "react";
import { api } from "../api";

export default function IpfsUpload({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/ipfs/file", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setOut(data);
      onUploaded?.(data.uri);
    } catch (err) {
      alert("upload failed: " + err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <input type="file" onChange={pick} disabled={busy} />
      {busy && <span className="text-sm">Uploading…</span>}
      {out && (
        <span className="text-xs font-mono text-slate-600">{out.uri}</span>
      )}
    </div>
  );
}
