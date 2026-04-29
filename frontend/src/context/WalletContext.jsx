import { createContext, useContext, useEffect, useState } from "react";
import { BrowserProvider } from "ethers";

const WalletCtx = createContext(null);
export const useWallet = () => useContext(WalletCtx);

const DEFAULT_CHAIN_ID = 11155111;
const wantChain = Number(import.meta.env.VITE_CHAIN_ID || DEFAULT_CHAIN_ID);
const wantChainHex = "0x" + wantChain.toString(16);

function parseChainId(value) {
  return typeof value === "string" ? Number(value) : Number(value || 0);
}

async function ensureNetwork() {
  const current = await window.ethereum.request({ method: "eth_chainId" });
  if (parseChainId(current) === wantChain) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: wantChainHex }],
    });
  } catch (error) {
    if (error?.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: wantChainHex,
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [import.meta.env.VITE_RPC_URL],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ],
    });
  }
}

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);

  async function connect() {
    if (!window.ethereum) {
      alert("Install MetaMask first.");
      return;
    }

    await ensureNetwork();
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const p = new BrowserProvider(window.ethereum);
    const net = await p.getNetwork();

    setProvider(p);
    setAccount(accounts[0] || null);
    setChainId(Number(net.chainId));
    return accounts[0] || null;
  }

  function disconnect() {
    setAccount(null);
    setProvider(null);
  }

  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => setAccount(accounts[0] || null);
    const handleChainChanged = (nextChainId) => {
      setChainId(parseChainId(nextChainId));
      setProvider(new BrowserProvider(window.ethereum));
    };

    window.ethereum.on?.("accountsChanged", handleAccountsChanged);
    window.ethereum.on?.("chainChanged", handleChainChanged);

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!accounts?.[0]) return;
        setAccount(accounts[0]);
        setProvider(new BrowserProvider(window.ethereum));
      })
      .catch(() => {});

    window.ethereum
      .request({ method: "eth_chainId" })
      .then((nextChainId) => setChainId(parseChainId(nextChainId)))
      .catch(() => {});

    return () => {
      window.ethereum.removeListener?.("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  return (
    <WalletCtx.Provider value={{ account, provider, chainId, connect, disconnect, wantChain }}>
      {children}
    </WalletCtx.Provider>
  );
}
