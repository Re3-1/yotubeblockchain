import { useEffect, useState } from "react";
import { Contract, formatUnits, isAddress, parseUnits } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { ChannelTokenABI, MarketplaceABI } from "../abi/index.js";

const MARKET = import.meta.env.VITE_MARKETPLACE_ADDRESS;
const backend = import.meta.env.VITE_BACKEND_URL;

function shortAddress(value) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "";
}

export default function CreatorDashboard() {
  const { account, provider, connect } = useWallet();
  const [me, setMe] = useState(null);
  const [myChannels, setMyChannels] = useState([]);
  const [err, setErr] = useState("");
  const [loadingChannels, setLoadingChannels] = useState(false);

  async function loadMe() {
    try {
      const { data } = await api.get("/auth/me");
      setMe(data);
    } catch {
      setMe(null);
    }
  }

  useEffect(() => {
    loadMe();
  }, []);

  async function fetchMyChannels() {
    setErr("");
    setLoadingChannels(true);
    try {
      const { data } = await api.get("/channels/mine");
      setMyChannels(data.channels || []);
    } catch (e) {
      const body = e?.response?.data;
      setErr(body?.error || String(e));
      if (body?.authUrl) {
        window.location.href = `${backend}${body.authUrl}`;
      }
    } finally {
      setLoadingChannels(false);
    }
  }

  async function verify(channelId) {
    if (!account) {
      await connect();
      return;
    }

    await api.post("/channels/verify", { channelId, wallet: account });
    await loadMe();
  }

  async function saveTokenAddress(channelId) {
    const address = prompt("Paste deployed ChannelToken address for " + channelId);
    if (!address) return;
    if (!isAddress(address)) {
      alert("That is not a valid contract address.");
      return;
    }
    await api.post(`/channels/${channelId}/token-contract`, { address });
    await loadMe();
  }

  if (!me) {
    return (
      <div className="text-center">
        <p className="mb-4">Sign in with Google to verify your YouTube channel.</p>
        <a
          href={`${backend}/auth/google`}
          className="bg-brand text-white px-6 py-3 rounded inline-block"
        >
          Sign in with Google
        </a>
      </div>
    );
  }

  const connectedCreatorWallet =
    account && me.wallet && account.toLowerCase() === me.wallet.toLowerCase();

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand">
            Hi {me.displayName || me.email}
          </h2>
          <p className="text-slate-600">
            Creator wallet: {me.wallet ? shortAddress(me.wallet) : "not bound"}
          </p>
        </div>
        <button
          onClick={connect}
          className="self-start bg-brand text-white px-4 py-2 rounded"
        >
          {account ? shortAddress(account) : "Connect Wallet"}
        </button>
      </div>

      {account && me.wallet && !connectedCreatorWallet && (
        <p className="mt-4 text-sm text-red-600">
          Connected wallet does not match the creator wallet for this account.
        </p>
      )}

      <section className="mt-8">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold">YouTube channels</h3>
          <button
            onClick={fetchMyChannels}
            className="text-sm bg-brand text-white px-3 py-1 rounded"
          >
            {loadingChannels ? "Loading..." : "Load from YouTube"}
          </button>
        </div>
        {err && <p className="mt-2 text-red-600">{err}</p>}

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {myChannels.map((channel) => (
            <div key={channel.channelId} className="bg-white p-4 rounded shadow">
              <div className="flex items-center gap-3">
                <img src={channel.thumbnail} alt="" className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-semibold">{channel.title}</div>
                  <div className="text-sm text-slate-500">
                    {channel.subscribers.toLocaleString()} subs ·{" "}
                    {channel.views.toLocaleString()} views
                  </div>
                </div>
              </div>
              <button
                onClick={() => verify(channel.channelId)}
                className="mt-3 bg-brand text-white px-3 py-1 rounded text-sm"
              >
                Bind to wallet
              </button>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mt-10">Creator tokens</h3>
        <div className="mt-3 space-y-4">
          {(me.verifiedChannels || []).map((channel) => (
            <div key={channel.channelId} className="bg-white p-4 rounded shadow">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold">{channel.title}</div>
                  <div className="text-sm text-slate-500">{channel.channelId}</div>
                </div>
                {channel.tokenContract ? (
                  <code className="text-xs break-all">{channel.tokenContract}</code>
                ) : (
                  <button
                    className="self-start underline text-brand"
                    onClick={() => saveTokenAddress(channel.channelId)}
                  >
                    Save token address
                  </button>
                )}
              </div>

              {channel.tokenContract && (
                <ListTokenForm
                  channel={channel}
                  creatorWallet={me.wallet}
                  account={account}
                  provider={provider}
                  connect={connect}
                />
              )}
            </div>
          ))}

          {(!me.verifiedChannels || me.verifiedChannels.length === 0) && (
            <p className="text-slate-500">No verified channels yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ListTokenForm({ channel, creatorWallet, account, provider, connect }) {
  const [amount, setAmount] = useState("100");
  const [price, setPrice] = useState("0.001");
  const [symbol, setSymbol] = useState("tokens");
  const [decimals, setDecimals] = useState(18);
  const [balance, setBalance] = useState(null);
  const [allowance, setAllowance] = useState(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshTokenState() {
    if (!provider || !account || !isAddress(channel.tokenContract)) return;
    const token = new Contract(channel.tokenContract, ChannelTokenABI, provider);
    const [nextSymbol, nextDecimals, nextBalance, nextAllowance] =
      await Promise.all([
        token.symbol(),
        token.decimals(),
        token.balanceOf(account),
        token.allowance(account, MARKET),
      ]);

    setSymbol(nextSymbol);
    setDecimals(Number(nextDecimals));
    setBalance(nextBalance);
    setAllowance(nextAllowance);
  }

  useEffect(() => {
    refreshTokenState().catch(() => {});
  }, [provider, account, channel.tokenContract]);

  async function listForSale() {
    setStatus("");
    if (!account) {
      await connect();
      setStatus("Wallet connected. Press List tokens again.");
      return;
    }
    if (!provider) {
      setStatus("Connect wallet again.");
      return;
    }
    if (!isAddress(MARKET) || !isAddress(channel.tokenContract)) {
      setStatus("Marketplace or token address is missing.");
      return;
    }

    setBusy(true);
    try {
      const parsedAmount = parseUnits(amount || "0", decimals);
      const parsedPrice = parseUnits(price || "0", 18);
      if (parsedAmount <= 0n || parsedPrice <= 0n) {
        setStatus("Enter an amount and price greater than zero.");
        return;
      }

      const signer = await provider.getSigner();
      const token = new Contract(channel.tokenContract, ChannelTokenABI, signer);
      const mkt = new Contract(MARKET, MarketplaceABI, signer);
      const currentBalance = await token.balanceOf(account);

      if (currentBalance < parsedAmount) {
        setStatus(`Only ${formatUnits(currentBalance, decimals)} ${symbol} available.`);
        return;
      }

      const currentAllowance = await token.allowance(account, MARKET);
      if (currentAllowance < parsedAmount) {
        setStatus("Approving marketplace...");
        const approveTx = await token.approve(MARKET, parsedAmount);
        await approveTx.wait();
      }

      setStatus("Creating listing...");
      const creator = creatorWallet || account;
      const listTx = await mkt.listForSale(
        channel.tokenContract,
        creator,
        parsedAmount,
        parsedPrice
      );
      await listTx.wait();
      setStatus("Listed on marketplace.");
      await refreshTokenState();
    } catch (error) {
      setStatus(error?.shortMessage || error?.reason || error?.message || String(error));
    } finally {
      setBusy(false);
    }
  }

  const balanceText =
    balance === null ? "Connect wallet" : `${formatUnits(balance, decimals)} ${symbol}`;
  const allowanceText =
    allowance === null ? "Connect wallet" : `${formatUnits(allowance, decimals)} ${symbol}`;

  return (
    <div className="mt-4 border-t pt-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">
          <span className="block text-slate-600">Amount</span>
          <input
            type="number"
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="block text-slate-600">Price per token, ETH</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2"
          />
        </label>
        <button
          onClick={listForSale}
          disabled={busy}
          className="bg-brand text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {busy ? "Working..." : "List tokens"}
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        <span>Balance: {balanceText}</span>
        <span>Allowance: {allowanceText}</span>
      </div>
      {status && <p className="mt-2 text-sm text-slate-700">{status}</p>}
    </div>
  );
}
