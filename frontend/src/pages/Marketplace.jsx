import { useEffect, useState } from "react";
import { Contract, formatEther, parseUnits } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { MarketplaceABI, ChannelTokenABI } from "../abi/index.js";

const MARKET = import.meta.env.VITE_MARKETPLACE_ADDRESS;

export default function Marketplace() {
  const { provider, account, connect } = useWallet();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!provider) return;
    setLoading(true);
    const mkt = new Contract(MARKET, MarketplaceABI, provider);
    const next = Number(await mkt.nextListingId());
    const rows = [];
    for (let i = 1; i <= next; i++) {
      const l = await mkt.listings(i);
      if (!l.active) continue;
      const token = new Contract(l.token, ChannelTokenABI, provider);
      const [name, symbol] = await Promise.all([token.name(), token.symbol()]);
      rows.push({
        id: i,
        seller: l.seller,
        token: l.token,
        creator: l.creator,
        amount: l.amount,
        price: l.pricePerToken,
        name,
        symbol,
      });
    }
    setListings(rows);
    setLoading(false);
  }

  useEffect(() => { load(); }, [provider]);

  async function buy(l, units) {
    const signer = await provider.getSigner();
    const mkt = new Contract(MARKET, MarketplaceABI, signer);
    const amount = parseUnits(String(units), 18);
    const total = (amount * l.price) / parseUnits("1", 18);
    const tx = await mkt.buy(l.id, amount, { value: total });
    await tx.wait();
    alert("Purchased!");
    load();
  }

  if (!account) {
    return (
      <div className="text-center">
        <p className="mb-4">Connect your wallet to view the marketplace.</p>
        <button onClick={connect} className="bg-brand text-white px-6 py-2 rounded">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand">Marketplace</h2>
      <p className="text-slate-600">Buy channel tokens. 2% royalty → creator, 1% → platform.</p>
      {loading && <p className="mt-4">Loading…</p>}
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {listings.map((l) => (
          <div key={l.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">{l.name} <span className="text-slate-400">({l.symbol})</span></div>
                <div className="text-sm text-slate-500">
                  Available: {(Number(l.amount) / 1e18).toLocaleString()}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">{formatEther(l.price)} MATIC</div>
                <div className="text-xs text-slate-400">per token</div>
              </div>
            </div>
            <BuyForm listing={l} onBuy={buy} />
          </div>
        ))}
        {!loading && listings.length === 0 && (
          <p className="text-slate-500">No active listings yet.</p>
        )}
      </div>
    </div>
  );
}

function BuyForm({ listing, onBuy }) {
  const [units, setUnits] = useState(1);
  return (
    <div className="mt-3 flex gap-2">
      <input
        type="number"
        min="1"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        className="border rounded px-2 py-1 w-24"
      />
      <button
        onClick={() => onBuy(listing, units)}
        className="bg-brand text-white px-3 py-1 rounded"
      >
        Buy {units}
      </button>
    </div>
  );
}
