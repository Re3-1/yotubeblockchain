import { useEffect, useState } from "react";
import { Contract } from "ethers";
import { api } from "../api";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { MilestoneABI } from "../abi/index.js";

const MS_ADDR = import.meta.env.VITE_MILESTONE_ADDRESS;

function outcomeLabel(value) {
  if (value === 1 || value === "Yes") return "Yes";
  if (value === 2 || value === "No") return "No";
  return "Pending";
}

export default function Milestones() {
  const { provider, account, connect } = useWallet();
  const { loggedIn, loginFan } = useAuth();
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  async function load() {
    try {
      const { data } = await api.get("/milestones");
      setItems(data);
    } catch (error) {
      setErr(error?.response?.data?.error || String(error));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function milestoneContract() {
    if (!loggedIn) {
      throw new Error("Log in as a creator or fan first.");
    }
    if (!account) {
      await connect();
      throw new Error("Wallet connected. Try the action again.");
    }
    if (!provider) throw new Error("Connect wallet again.");
    const signer = await provider.getSigner();
    return new Contract(MS_ADDR, MilestoneABI, signer);
  }

  async function create(form) {
    setErr("");
    setStatus("Creating milestone...");
    try {
      const contract = await milestoneContract();
      const deadline = Math.floor(new Date(form.deadline).getTime() / 1000);
      const tx = await contract.createChallenge(
        form.channelId,
        form.metric,
        Number(form.target),
        deadline,
        form.badgeUri || "ipfs://placeholder"
      );
      const receipt = await tx.wait();
      const event = receipt.logs
        .map((log) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((entry) => entry?.name === "ChallengeCreated");

      if (!event) throw new Error("ChallengeCreated event not found.");
      const id = Number(event.args.id);

      await api.post("/milestones", {
        challengeId: id,
        creator: account,
        channelId: form.channelId,
        metric: form.metric,
        target: Number(form.target),
        deadline: new Date(form.deadline),
        badgeUri: form.badgeUri || "ipfs://placeholder",
      });

      setStatus(`Created milestone #${id}.`);
      await load();
    } catch (error) {
      setStatus("");
      setErr(error?.shortMessage || error?.reason || error?.message || String(error));
    }
  }

  async function join(id, prediction) {
    setErr("");
    setStatus("Submitting prediction...");
    try {
      const contract = await milestoneContract();
      const tx = await contract.join(id, prediction);
      await tx.wait();
      setStatus(`Joined milestone #${id} with ${outcomeLabel(prediction)}.`);
    } catch (error) {
      setStatus("");
      setErr(error?.shortMessage || error?.reason || error?.message || String(error));
    }
  }

  async function claim(id) {
    setErr("");
    setStatus("Claiming badge...");
    try {
      const contract = await milestoneContract();
      const tx = await contract.claimBadge(id);
      await tx.wait();
      setStatus(`Claimed badge for milestone #${id}.`);
    } catch (error) {
      setStatus("");
      setErr(error?.shortMessage || error?.reason || error?.message || String(error));
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-brand">Milestone Challenges</h2>
          <p className="text-slate-600">
            Predict channel milestones. Winners can claim NFT badges after the oracle resolves.
          </p>
        </div>
        {!loggedIn && (
          <button onClick={loginFan} className="self-start bg-brand text-white px-4 py-2 rounded">
            Fan Login
          </button>
        )}
      </div>

      {status && <p className="mt-4 text-slate-700">{status}</p>}
      {err && <p className="mt-4 text-red-600">{err}</p>}

      <CreateForm onCreate={create} disabled={!loggedIn || !account} />

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        {items.map((milestone) => (
          <div key={milestone.challengeId} className="bg-white rounded shadow p-4">
            <div className="font-semibold">
              Will {milestone.channelId} reach {milestone.target.toLocaleString()}{" "}
              {milestone.metric}?
            </div>
            <div className="text-sm text-slate-500">
              by {new Date(milestone.deadline).toLocaleString()}
            </div>
            <div className="text-sm mt-2">
              Status: {milestone.resolved ? milestone.outcome : "open"}
              {milestone.resolved && (
                <> - actual {milestone.actualValue?.toLocaleString()}</>
              )}
            </div>
            {!milestone.resolved && (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => join(milestone.challengeId, 1)}
                  disabled={!loggedIn}
                  className="bg-green-600 text-white px-3 py-1 rounded"
                >
                  YES
                </button>
                <button
                  onClick={() => join(milestone.challengeId, 2)}
                  disabled={!loggedIn}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  NO
                </button>
              </div>
            )}
            {milestone.resolved && (
              <button
                onClick={() => claim(milestone.challengeId)}
                disabled={!loggedIn}
                className="mt-3 bg-brand text-white px-3 py-1 rounded"
              >
                Claim badge if I won
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-slate-500">No milestones yet.</p>}
      </div>
    </div>
  );
}

function CreateForm({ onCreate, disabled }) {
  const [form, setForm] = useState({
    channelId: "UCP7C5EMX6bEyikran5tvlKQ",
    metric: "subscribers",
    target: 50000,
    deadline: "",
    badgeUri: "",
  });

  const set = (key) => (event) => {
    setForm({ ...form, [key]: event.target.value });
  };

  return (
    <form
      className="mt-6 bg-white p-4 rounded shadow grid md:grid-cols-2 gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(form);
      }}
    >
      <input
        required
        placeholder="Channel ID (UC...)"
        value={form.channelId}
        onChange={set("channelId")}
        className="border rounded px-2 py-1"
      />
      <select
        value={form.metric}
        onChange={set("metric")}
        className="border rounded px-2 py-1"
      >
        <option value="subscribers">subscribers</option>
        <option value="views">views</option>
        <option value="videos">videos</option>
      </select>
      <input
        required
        type="number"
        min="1"
        placeholder="Target"
        value={form.target}
        onChange={set("target")}
        className="border rounded px-2 py-1"
      />
      <input
        required
        type="datetime-local"
        value={form.deadline}
        onChange={set("deadline")}
        className="border rounded px-2 py-1"
      />
      <input
        placeholder="Badge IPFS URI (optional)"
        value={form.badgeUri}
        onChange={set("badgeUri")}
        className="border rounded px-2 py-1 md:col-span-2"
      />
      <button
        disabled={disabled}
        className="bg-brand text-white rounded px-4 py-2 md:col-span-2 disabled:opacity-60"
      >
        {disabled ? "Log in and connect wallet to create" : "Create challenge"}
      </button>
    </form>
  );
}
