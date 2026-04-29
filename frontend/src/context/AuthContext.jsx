import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api.js";
import { useWallet } from "./WalletContext.jsx";

const AuthCtx = createContext(null);
const FAN_SESSION_KEY = "ytbc_fan_account";

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const { account, connect, disconnect } = useWallet();
  const [creator, setCreator] = useState(null);
  const [fanAccount, setFanAccount] = useState(() =>
    localStorage.getItem(FAN_SESSION_KEY)
  );
  const [loadingCreator, setLoadingCreator] = useState(true);

  async function refreshCreator() {
    setLoadingCreator(true);
    try {
      const { data } = await api.get("/auth/me");
      setCreator(data);
      return data;
    } catch {
      setCreator(null);
      return null;
    } finally {
      setLoadingCreator(false);
    }
  }

  useEffect(() => {
    refreshCreator();
  }, []);

  useEffect(() => {
    if (!fanAccount || !account) return;
    if (fanAccount.toLowerCase() !== account.toLowerCase()) {
      localStorage.removeItem(FAN_SESSION_KEY);
      setFanAccount(null);
    }
  }, [account, fanAccount]);

  async function loginFan() {
    const connected = account || (await connect());
    if (!connected) return null;
    localStorage.setItem(FAN_SESSION_KEY, connected);
    setFanAccount(connected);
    return connected;
  }

  async function logoutAll() {
    await api.post("/auth/logout").catch(() => {});
    localStorage.removeItem(FAN_SESSION_KEY);
    setCreator(null);
    setFanAccount(null);
    disconnect();
    window.location.href = "/";
  }

  const fanLoggedIn = Boolean(
    account &&
    fanAccount &&
    account.toLowerCase() === fanAccount.toLowerCase()
  );
  const creatorLoggedIn = Boolean(creator);
  const loggedIn = creatorLoggedIn || fanLoggedIn;

  return (
    <AuthCtx.Provider
      value={{
        creator,
        creatorLoggedIn,
        fanAccount,
        fanLoggedIn,
        loggedIn,
        loadingCreator,
        loginFan,
        logoutAll,
        refreshCreator,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
