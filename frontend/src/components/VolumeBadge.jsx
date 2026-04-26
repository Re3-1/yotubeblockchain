import { useEffect, useState } from "react";
import { api } from "../api";

export default function VolumeBadge({ token }) {
  const [v, setV] = useState(null);
  useEffect(() => {
    if (!token) return;
    api.get(`/analytics/volume/${token}`).then((r) => setV(r.data));
  }, [token]);
  if (!v) return null;
  return (
    <div className="inline-flex gap-3 text-sm bg-slate-100 rounded px-3 py-1">
      <span>{v.trades} trades</span>
      <span>{v.tokens.toLocaleString()} tokens</span>
    </div>
  );
}
