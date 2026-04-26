import { createContext, useContext, useEffect, useState } from "react";
import { BrowserProvider } from "ethers";

const WalletCtx = createContext(null);
export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [chainId, setChainId] = useState(null);

  const wantChain = Number(import.meta.env.VITE_CHAIN_ID || 80001);

  async function connect() {
    if (!window.ethereum) {
      alert("Install MetaMask first.");
      return;
    }
    const p = new BrowserProvider(window.ethereum);
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const net = await p.getNetwork();
    setProvider(p);
    setAccount(accounts[0]);
    setChainId(Number(net.chainId));

    if (Number(net.chainId) !== wantChain) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + wantChain.toString(16) }],
        });
      } catch (e) {
        // add chain if unknown
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x" + wantChain.toString(16),
              chainName: "Polygon Mumbai",
              nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
              rpcUrls: [import.meta.env.VITE_RPC_URL],
              blockExplorerUrls: ["https://mumbai.polygonscan.com"],
            },
          ],
        });
      }
    }
  }

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on?.("accountsChanged", (a) => setAccount(a[0] || null));
    window.ethereum.on?.("chainChanged", (c) => setChainId(Number(c)));
  }, []);

  return (
    <WalletCtx.Provider value={{ account, provider, chainId, connect }}>
      {children}
    </WalletCtx.Provider>
  );
}
