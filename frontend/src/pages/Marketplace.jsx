import { useEffect, useMemo, useState } from "react";
import { Contract, JsonRpcProvider, formatEther, formatUnits, parseUnits } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { MarketplaceABI, ChannelTokenABI } from "../abi/index.js";

const MARKET = import.meta.env.VITE_MARKETPLACE_ADDRESS;
const RPC_URL = import.meta.env.VITE_RPC_URL;
const BPS_DENOMINATOR = 10000n;

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export default function Marketplace() {
  const { provider, account, connect } = useWallet();
  const { loggedIn, loginFan } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const readProvider = useMemo(() => {
    if (provider) return provider;
    if (RPC_URL) return new JsonRpcProvider(RPC_URL);
    return null;
  }, [provider]);

  async function load() {
    if (!loggedIn || !readProvider || !MARKET) return;
    setLoading(true);
    setErr("");
    try {
      const mkt = new Contract(MARKET, MarketplaceABI, readProvider);
      const next = Number(await mkt.nextListingId());
      const rows = [];

      for (let id = 1; id <= next; id += 1) {
        const listing = await mkt.listings(id);
        if (!listing.active) continue;

        const token = new Contract(listing.token, ChannelTokenABI, readProvider);
        const [name, symbol, decimals, channelId] = await Promise.all([
          token.name(),
          token.symbol(),
          token.decimals(),
          token.channelId().catch(() => ""),
        ]);

        rows.push({
          id,
          seller: listing.seller,
          token: listing.token,
          creator: listing.creator,
          amount: listing.amount,
          price: listing.pricePerToken,
          name,
          symbol,
          decimals: Number(decimals),
          channelId,
        });
      }

      setListings(rows);
    } catch (error) {
      setErr(error?.shortMessage || error?.message || String(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [loggedIn, readProvider]);

  async function buy(listing, units) {
    if (!loggedIn) throw new Error("Log in as a creator or fan first.");
    if (!account) {
      await connect();
      return false;
    }
    if (!provider) throw new Error("Connect wallet again.");

    const amount = parseUnits(String(units || "0"), listing.decimals);
    if (amount <= 0n) throw new Error("Enter an amount greater than zero.");
    if (amount > listing.amount) throw new Error("Amount exceeds available tokens.");

    const signer = await provider.getSigner();
    const mkt = new Contract(MARKET, MarketplaceABI, signer);
    const unit = 10n ** BigInt(listing.decimals);
    const total = (amount * listing.price) / unit;
    const [royaltyBps, platformFeeBps] = await Promise.all([
      mkt.royaltyBps(),
      mkt.platformFeeBps(),
    ]);
    const royalty = (total * BigInt(royaltyBps)) / BPS_DENOMINATOR;
    const platformFee = (total * BigInt(platformFeeBps)) / BPS_DENOMINATOR;

    const tx = await mkt.buy(listing.id, amount, { value: total });
    const receipt = await tx.wait();

    await api.post("/trades", {
      listingId: listing.id,
      tokenContract: listing.token,
      buyer: account,
      seller: listing.seller,
      creator: listing.creator,
      amount: amount.toString(),
      pricePerToken: listing.price.toString(),
      total: total.toString(),
      royalty: royalty.toString(),
      platformFee: platformFee.toString(),
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });

    await load();
    return true;
  }

  async function cancel(listing) {
    if (!loggedIn) return;
    if (!account || !provider) {
      await connect();
      return;
    }
    const signer = await provider.getSigner();
    const mkt = new Contract(MARKET, MarketplaceABI, signer);
    const tx = await mkt.cancel(listing.id);
    await tx.wait();
    await load();
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand">Marketplace</h2>
          <p className="text-slate-600">Buy channel tokens on Sepolia.</p>
        </div>
        <button onClick={load} className="self-start border px-4 py-2 rounded">
          Refresh
        </button>
      </div>

      {!loggedIn && (
        <div className="mt-6 bg-white rounded shadow p-6 text-center">
          <p className="mb-4">Log in as a fan or creator to view and trade listings.</p>
          <button onClick={loginFan} className="bg-brand text-white px-5 py-2 rounded">
            Fan Login
          </button>
        </div>
      )}

      {err && <p className="mt-4 text-red-600">{err}</p>}
      {loggedIn && loading && <p className="mt-4">Loading...</p>}

      {loggedIn && <div className="mt-6 grid md:grid-cols-2 gap-4">
        {listings.map((listing) => (
          <div key={listing.id} className="bg-white p-4 rounded shadow">
            <div className="flex justify-between gap-4">
              <div>
                <div className="font-semibold">
                  {listing.name}{" "}
                  <span className="text-slate-400">({listing.symbol})</span>
                </div>
                <div className="text-sm text-slate-500">
                  {listing.channelId || shortAddress(listing.token)}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Seller: {shortAddress(listing.seller)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">{formatEther(listing.price)} ETH</div>
                <div className="text-xs text-slate-400">per token</div>
              </div>
            </div>

            <div className="mt-3 text-sm text-slate-600">
              Available: {formatUnits(listing.amount, listing.decimals)}{" "}
              {listing.symbol}
            </div>

            <BuyForm listing={listing} account={account} onBuy={buy} />

            {account?.toLowerCase() === listing.seller.toLowerCase() && (
              <button
                onClick={() => cancel(listing)}
                className="mt-3 text-sm underline text-red-600"
              >
                Cancel listing
              </button>
            )}
          </div>
        ))}

        {!loading && listings.length === 0 && (
          <p className="text-slate-500">No active listings yet.</p>
        )}
      </div>}
    </div>
  );
}

function BuyForm({ listing, account, onBuy }) {
  const [units, setUnits] = useState("1");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function submit() {
    setBusy(true);
    setStatus("");
    try {
      const purchased = await onBuy(listing, units);
      setStatus(purchased ? "Purchased." : "Wallet connected. Press Buy again.");
    } catch (error) {
      setStatus(error?.shortMessage || error?.reason || error?.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="1"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          className="border rounded px-2 py-1 w-28"
        />
        <button
          onClick={submit}
          disabled={busy}
          className="bg-brand text-white px-3 py-1 rounded disabled:opacity-60"
        >
          {busy ? "Working..." : account ? "Buy" : "Connect to buy"}
        </button>
      </div>
      {status && <p className="mt-2 text-sm text-slate-600">{status}</p>}
    </div>
  );
}
