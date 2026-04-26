import { useEffect, useState } from "react";
import { Contract } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { MilestoneABI } from "../abi/index.js";

const MS_ADDR = import.meta.env.VITE_MILESTONE_ADDRESS;

export default function Milestones() {
  const { provider, account } = useWallet();
  const [items, setItems] = useState([]);

  async function load() {
    const { data } = await api.get("/milestones");
    setItems(data);
  }
  useEffect(() => { load(); }, []);

  async function create(form) {
    const signer = await provider.getSigner();
    const c = new Contract(MS_ADDR, MilestoneABI, signer);
    const tx = await c.createChallenge(
      form.channelId,
      form.metric,
      Number(form.target),
      Math.floor(new Date(form.deadline).getTime() / 1000),
      form.badgeUri || "ipfs://placeholder"
    );
    const rcpt = await tx.wait();
    // Parse log to get challenge id
    const evt = rcpt.logs.map((l) => {
      try { return c.interface.parseLog(l); } catch { return null; }
    }).find((e) => e?.name === "ChallengeCreated");
    const id = Number(evt.args.id);

    await api.post("/milestones", {
      challengeId: id,
      creator: account,
      channelId: form.channelId,
      metric: form.metric,
      target: Number(form.target),
      deadline: new Date(form.deadline),
      badgeUri: form.badgeUri || "ipfs://placeholder",
    });
    load();
  }

  async function join(id, prediction) {
    const signer = await provider.getSigner();
    const c = new Contract(MS_ADDR, MilestoneABI, signer);
    const tx = await c.join(id, prediction); // 1=Yes, 2=No
    await tx.wait();
    alert("Joined!");
  }

  async function claim(id) {
    const signer = await provider.getSigner();
    const c = new Contract(MS_ADDR, MilestoneABI, signer);
    const tx = await c.claimBadge(id);
    await tx.wait();
    alert("Badge claimed!");
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-brand">Milestone Challenges</h2>
      <p className="text-slate-600">Predict channel milestones. Win NFT badges — no money staked.</p>

      <CreateForm onCreate={create} />

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {items.map((m) => (
          <div key={m.challengeId} className="bg-white rounded shadow p-4">
            <div className="font-semibold">
              Will {m.channelId} reach {m.target.toLocaleString()} {m.metric}?
            </div>
            <div className="text-sm text-slate-500">
              by {new Date(m.deadline).toLocaleString()}
            </div>
            <div className="text-sm mt-2">
              Status: {m.resolved ? m.outcome : "open"}
              {m.resolved && (
                <> — actual {m.actualValue?.toLocaleString()}</>
              )}
            </div>
            {!m.resolved && (
              <div className="mt-3 flex gap-2">
                <button onClick={() => join(m.challengeId, 1)} className="bg-green-600 text-white px-3 py-1 rounded">YES</button>
                <button onClick={() => join(m.challengeId, 2)} className="bg-red-600 text-white px-3 py-1 rounded">NO</button>
              </div>
            )}
            {m.resolved && (
              <button onClick={() => claim(m.challengeId)} className="mt-3 bg-brand text-white px-3 py-1 rounded">
                Claim badge if I won
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateForm({ onCreate }) {
  const [f, setF] = useState({
    channelId: "", metric: "subscribers", target: 50000,
    deadline: "", badgeUri: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form
      className="mt-6 bg-white p-4 rounded shadow grid md:grid-cols-2 gap-3"
      onSubmit={(e) => { e.preventDefault(); onCreate(f); }}
    >
      <input required placeholder="Channel ID (UC...)" value={f.channelId}
        onChange={set("channelId")} className="border rounded px-2 py-1" />
      <select value={f.metric} onChange={set("metric")} className="border rounded px-2 py-1">
        <option value="subscribers">subscribers</option>
        <option value="views">views</option>
        <option value="videos">videos</option>
      </select>
      <input required type="number" placeholder="Target" value={f.target}
        onChange={set("target")} className="border rounded px-2 py-1" />
      <input required type="datetime-local" value={f.deadline}
        onChange={set("deadline")} className="border rounded px-2 py-1" />
      <input placeholder="Badge IPFS URI (optional)" value={f.badgeUri}
        onChange={set("badgeUri")} className="border rounded px-2 py-1 md:col-span-2" />
      <button className="bg-brand text-white rounded px-4 py-2 md:col-span-2">
        Create challenge
      </button>
    </form>
  );
}
