import { useEffect, useState } from "react";
import { Contract } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { ChannelTokenABI, BadgeABI } from "../abi/index.js";

const BADGE = import.meta.env.VITE_BADGE_ADDRESS;

export default function FanDashboard() {
  const { provider, account } = useWallet();
  const [trades, setTrades] = useState([]);
  const [badges, setBadges] = useState(0);
  const [holdings, setHoldings] = useState([]);

  useEffect(() => {
    api.get("/trades").then((r) => {
      setTrades(
        r.data.filter(
          (t) => t.buyer?.toLowerCase() === account?.toLowerCase()
        )
      );
    });
  }, [account]);

  useEffect(() => {
    if (!provider || !account) return;
    const b = new Contract(BADGE, BadgeABI, provider);
    b.balanceOf(account).then((n) => setBadges(Number(n)));
  }, [provider, account]);

  useEffect(() => {
    // derive holdings: for each token contract the user has traded, read balanceOf
    (async () => {
      if (!provider || !account) return;
      const unique = [...new Set(trades.map((t) => t.tokenContract))];
      const rows = [];
      for (const addr of unique) {
        const c = new Contract(addr, ChannelTokenABI, provider);
        const [name, symbol, bal] = await Promise.all([
          c.name(), c.symbol(), c.balanceOf(account),
        ]);
        rows.push({ addr, name, symbol, balance: Number(bal) / 1e18 });
      }
      setHoldings(rows);
    })();
  }, [trades, provider, account]);

  if (!account) return <p>Connect wallet.</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand">Fan Dashboard</h2>

      <section className="mt-6">
        <h3 className="font-semibold">Your portfolio</h3>
        <ul className="mt-2 divide-y">
          {holdings.map((h) => (
            <li key={h.addr} className="py-2 flex justify-between">
              <span>{h.name} ({h.symbol})</span>
              <span className="font-mono">{h.balance.toLocaleString()}</span>
            </li>
          ))}
          {holdings.length === 0 && <li className="py-2 text-slate-500">Nothing yet.</li>}
        </ul>
      </section>

      <section className="mt-8">
        <h3 className="font-semibold">Badges earned</h3>
        <p className="text-slate-600">{badges} NFT badge(s) in wallet</p>
      </section>

      <section className="mt-8">
        <h3 className="font-semibold">Your purchases</h3>
        <ul className="mt-2 divide-y">
          {trades.map((t) => (
            <li key={t._id} className="py-2 text-sm flex justify-between">
              <span>{t.tokenContract?.slice(0, 10)}…</span>
              <span>{(Number(t.amount) / 1e18).toLocaleString()} tokens</span>
              <a
                href={`https://mumbai.polygonscan.com/tx/${t.txHash}`}
                className="underline text-brand"
                target="_blank"
                rel="noreferrer"
              >
                tx
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
