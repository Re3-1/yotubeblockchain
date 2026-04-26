import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "../api";

export default function PriceChart({ token, days = 30 }) {
  const [data, setData] = useState([]);
  useEffect(() => {
    if (!token) return;
    api.get("/analytics/price-history", { params: { token, days } })
      .then((r) => setData(r.data.series))
      .catch(() => setData([]));
  }, [token, days]);

  if (!data.length) {
    return <p className="text-slate-500 text-sm">No trades yet.</p>;
  }

  return (
    <div className="h-56 bg-white p-3 rounded shadow">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="avgPrice" stroke="#1F3A68" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
