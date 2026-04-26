import { useEffect, useState } from "react";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";

export default function CreatorDashboard() {
  const { account, connect } = useWallet();
  const [me, setMe] = useState(null);
  const [myChannels, setMyChannels] = useState([]);
  const [err, setErr] = useState("");

  const backend = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    api.get("/auth/me").then((r) => setMe(r.data)).catch(() => setMe(null));
  }, []);

  async function fetchMyChannels() {
    try {
      const { data } = await api.get("/channels/mine");
      setMyChannels(data.channels);
    } catch (e) {
      setErr(e?.response?.data?.error || String(e));
    }
  }

  async function verify(channelId) {
    if (!account) return alert("Connect wallet first.");
    await api.post("/channels/verify", { channelId, wallet: account });
    alert("Channel bound to your wallet. Now deploy its ChannelToken from Hardhat and paste the address below.");
    const { data } = await api.get("/auth/me");
    setMe(data);
  }

  async function saveTokenAddress(channelId) {
    const address = prompt("Paste deployed ChannelToken address for " + channelId);
    if (!address) return;
    await api.post(`/channels/${channelId}/token-contract`, { address });
    const { data } = await api.get("/auth/me");
    setMe(data);
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

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand">
        Hi {me.displayName || me.email}
      </h2>
      <p className="text-slate-600">
        Wallet: {me.wallet || (
          <button className="underline" onClick={connect}>connect</button>
        )}
      </p>

      <section className="mt-8">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold">Your verified channels</h3>
          <button
            onClick={fetchMyChannels}
            className="text-sm bg-brand text-white px-3 py-1 rounded"
          >
            Load from YouTube
          </button>
        </div>
        {err && <p className="text-red-600">{err}</p>}

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {myChannels.map((c) => (
            <div key={c.channelId} className="bg-white p-4 rounded shadow">
              <div className="flex items-center gap-3">
                <img src={c.thumbnail} alt="" className="w-12 h-12 rounded-full" />
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-sm text-slate-500">
                    {c.subscribers.toLocaleString()} subs · {c.views.toLocaleString()} views
                  </div>
                </div>
              </div>
              <button
                onClick={() => verify(c.channelId)}
                className="mt-3 bg-brand text-white px-3 py-1 rounded text-sm"
              >
                Bind to wallet
              </button>
            </div>
          ))}
        </div>

        <h3 className="text-xl font-semibold mt-10">Already bound</h3>
        <ul className="mt-3 space-y-2">
          {me.verifiedChannels.map((c) => (
            <li key={c.channelId} className="bg-white p-3 rounded shadow flex justify-between">
              <span>{c.title} ({c.channelId})</span>
              <span className="text-sm">
                {c.tokenContract ? (
                  <code>{c.tokenContract}</code>
                ) : (
                  <button className="underline" onClick={() => saveTokenAddress(c.channelId)}>
                    save token address
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
