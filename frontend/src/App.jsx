import { Routes, Route, Link } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import CreatorDashboard from "./pages/CreatorDashboard.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import FanDashboard from "./pages/FanDashboard.jsx";
import Milestones from "./pages/Milestones.jsx";
import { useWallet } from "./context/WalletContext.jsx";

export default function App() {
  const { account, connect } = useWallet();
  return (
    <div className="min-h-screen">
      <nav className="bg-brand text-white px-6 py-4 flex gap-6 items-center">
        <Link to="/" className="font-bold text-lg">YT-Chain</Link>
        <Link to="/marketplace">Marketplace</Link>
        <Link to="/dashboard">Creator</Link>
        <Link to="/fan">Fan</Link>
        <Link to="/milestones">Milestones</Link>
        <div className="ml-auto">
          {account ? (
            <span className="bg-white/20 px-3 py-1 rounded">
              {account.slice(0, 6)}…{account.slice(-4)}
            </span>
          ) : (
            <button
              onClick={connect}
              className="bg-white text-brand px-3 py-1 rounded font-medium"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<CreatorDashboard />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/fan" element={<FanDashboard />} />
          <Route path="/milestones" element={<Milestones />} />
        </Routes>
      </main>
    </div>
  );
}
