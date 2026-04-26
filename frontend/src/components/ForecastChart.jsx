import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart,
} from "recharts";
import { api } from "../api";

export default function ForecastChart({ token, channelId }) {
  const [data, setData] = useState([]);
  const [strategy, setStrategy] = useState("");

  useEffect(() => {
    if (!token) return;
    api.get(`/forecast/${token}`, { params: { channelId, horizon: 7 } })
      .then((r) => {
        setStrategy(r.data.strategy);
        setData(r.data.forecast.map((p) => ({
          ...p, band: [p.lower, p.upper],
        })));
      })
      .catch(() => setData([]));
  }, [token, channelId]);

  if (!data.length) return null;

  return (
    <div className="bg-white p-3 rounded shadow">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">7-day forecast</span>
        <span className="text-slate-500">{strategy}</span>
      </div>
      <div className="h-48">
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="band" stroke="none" fill="#93c5fd" />
            <Line type="monotone" dataKey="predicted" stroke="#1F3A68" dot />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
