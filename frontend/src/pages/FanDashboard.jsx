import { useEffect, useState } from "react";
import { Contract, formatEther, formatUnits, parseUnits } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ChannelTokenABI, BadgeABI, MarketplaceABI } from "../abi/index.js";

const BADGE = import.meta.env.VITE_BADGE_ADDRESS;
const MARKET = import.meta.env.VITE_MARKETPLACE_ADDRESS;

function shortAddress(value) {
  return value ? `${value.slice(0, 10)}...${value.slice(-4)}` : "";
}

export default function FanDashboard() {
  const { provider, account, connect } = useWallet();
  const { fanLoggedIn, loginFan } = useAuth();
  const [trades, setTrades] = useState([]);
  const [badges, setBadges] = useState(0);
  const [holdings, setHoldings] = useState([]);
  const [err, setErr] = useState("");

  async function loadTrades() {
    if (!fanLoggedIn || !account) {
      setTrades([]);
      return;
    }

    try {
      const { data } = await api.get("/trades");
      setTrades(
        data.filter(
          (trade) => trade.buyer?.toLowerCase() === account.toLowerCase()
        )
      );
    } catch (error) {
      setErr(error?.response?.data?.error || String(error));
    }
  }

  useEffect(() => {
    loadTrades();
  }, [fanLoggedIn, account]);

  useEffect(() => {
    if (!fanLoggedIn || !provider || !account || !BADGE) return;
    const badge = new Contract(BADGE, BadgeABI, provider);
    badge
      .balanceOf(account)
      .then((count) => setBadges(Number(count)))
      .catch(() => setBadges(0));
  }, [fanLoggedIn, provider, account]);

  async function loadHoldings() {
    if (!fanLoggedIn || !provider || !account) {
      setHoldings([]);
      return;
    }

    const creatorByToken = new Map();
    for (const trade of trades) {
      if (trade.tokenContract && trade.creator) {
        creatorByToken.set(trade.tokenContract.toLowerCase(), trade.creator);
      }
    }

    const uniqueTokens = [
      ...new Set(trades.map((trade) => trade.tokenContract).filter(Boolean)),
    ];
    const rows = [];

    for (const address of uniqueTokens) {
      try {
        const token = new Contract(address, ChannelTokenABI, provider);
        const [name, symbol, decimals, balance, channelId] = await Promise.all([
          token.name(),
          token.symbol(),
          token.decimals(),
          token.balanceOf(account),
          token.channelId().catch(() => ""),
        ]);
        rows.push({
          address,
          name,
          symbol,
          decimals: Number(decimals),
          channelId,
          creator: creatorByToken.get(address.toLowerCase()) || account,
          rawBalance: balance,
          balance: formatUnits(balance, Number(decimals)),
        });
      } catch {
        rows.push({
          address,
          name: shortAddress(address),
          symbol: "TOKEN",
          decimals: 18,
          channelId: "",
          creator: account,
          rawBalance: 0n,
          balance: "0",
        });
      }
    }

    setHoldings(rows);
  }

  useEffect(() => {
    loadHoldings();
  }, [trades, fanLoggedIn, provider, account]);

  if (!fanLoggedIn) {
    return (
      <div className="text-center">
        <p className="mb-4">Fan login is required to view purchases and sell tokens.</p>
        <button onClick={loginFan} className="bg-brand text-white px-6 py-2 rounded">
          Fan Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand">Fan Dashboard</h2>
          <p className="text-slate-600">{shortAddress(account)}</p>
        </div>
        {!account && (
          <button onClick={connect} className="self-start bg-brand text-white px-4 py-2 rounded">
            Connect Wallet
          </button>
        )}
      </div>
      {err && <p className="mt-3 text-red-600">{err}</p>}

      <section className="mt-6">
        <h3 className="font-semibold">Your portfolio</h3>
        <div className="mt-2 space-y-3">
          {holdings.map((holding) => (
            <div key={holding.address} className="bg-white rounded shadow p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <span>
                  <span className="font-medium">
                    {holding.name} ({holding.symbol})
                  </span>
                  {holding.channelId && (
                    <span className="block text-xs text-slate-500">
                      {holding.channelId}
                    </span>
                  )}
                </span>
                <span className="font-mono">{holding.balance}</span>
              </div>
              {holding.rawBalance > 0n && (
                <SellHoldingForm holding={holding} onListed={loadHoldings} />
              )}
            </div>
          ))}
          {holdings.length === 0 && (
            <p className="py-2 text-slate-500">Nothing yet.</p>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="font-semibold">Badges earned</h3>
        <p className="text-slate-600">{badges} NFT badge(s) in wallet</p>
      </section>

      <section className="mt-8">
        <h3 className="font-semibold">Your purchases</h3>
        <ul className="mt-2 divide-y">
          {trades.map((trade) => (
            <li key={trade._id} className="py-3 text-sm grid gap-2 md:grid-cols-4">
              <span>{shortAddress(trade.tokenContract)}</span>
              <span>{formatUnits(BigInt(trade.amount || "0"), 18)} tokens</span>
              <span>{formatEther(BigInt(trade.total || "0"))} ETH</span>
              {trade.txHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${trade.txHash}`}
                  className="underline text-brand md:text-right"
                  target="_blank"
                  rel="noreferrer"
                >
                  tx
                </a>
              ) : (
                <span />
              )}
            </li>
          ))}
          {trades.length === 0 && (
            <li className="py-2 text-slate-500">No purchases yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function SellHoldingForm({ holding, onListed }) {
  const { provider, account } = useWallet();
  const [amount, setAmount] = useState("1");
  const [price, setPrice] = useState("0.001");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function listForSale() {
    setBusy(true);
    setStatus("");
    try {
      if (!provider || !account) throw new Error("Connect wallet again.");

      const parsedAmount = parseUnits(amount || "0", holding.decimals);
      const parsedPrice = parseUnits(price || "0", 18);
      if (parsedAmount <= 0n) throw new Error("Enter an amount greater than zero.");
      if (parsedAmount > holding.rawBalance) throw new Error("Amount exceeds your balance.");

      const signer = await provider.getSigner();
      const token = new Contract(holding.address, ChannelTokenABI, signer);
      const market = new Contract(MARKET, MarketplaceABI, signer);
      const allowance = await token.allowance(account, MARKET);

      if (allowance < parsedAmount) {
        setStatus("Approving marketplace...");
        const approveTx = await token.approve(MARKET, parsedAmount);
        await approveTx.wait();
      }

      setStatus("Creating resale listing...");
      const tx = await market.listForSale(
        holding.address,
        holding.creator,
        parsedAmount,
        parsedPrice
      );
      await tx.wait();
      setStatus("Listed for sale.");
      await onListed();
    } catch (error) {
      setStatus(error?.shortMessage || error?.reason || error?.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t pt-3">
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">
          <span className="block text-slate-600">Sell amount</span>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 w-full border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Price per token, ETH</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="mt-1 w-full border rounded px-2 py-1"
          />
        </label>
        <button
          onClick={listForSale}
          disabled={busy}
          className="bg-brand text-white px-3 py-2 rounded disabled:opacity-60"
        >
          {busy ? "Working..." : "Sell"}
        </button>
      </div>
      {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
    </div>
  );
}
