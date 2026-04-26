# Runbook — step-by-step to get this running

Follow these in order. Each step has a checkpoint; don't move on until the check passes.

## 0. Install globally
- Node.js 20 LTS, Git, VS Code
- MetaMask browser extension
- (optional) Docker if you want MongoDB locally, else use free MongoDB Atlas cluster.

## 1. Contracts
```bash
cd contracts
npm install
cp .env.example .env            # fill DEPLOYER_PRIVATE_KEY with a throwaway test wallet
npx hardhat test                # should all pass
npx hardhat node                # leave running in its own terminal
npx hardhat run scripts/deploy.js --network localhost
```
**Checkpoint:** `contracts/deployments/localhost.json` now contains 4 addresses.

Later, for testnet:
```bash
# get free test MATIC from https://mumbaifaucet.com
npx hardhat run scripts/deploy.js --network mumbai
```

## 2. Backend
```bash
cd backend
npm install
cp .env.example .env            # fill Google OAuth + YT_API_KEY + contract addresses
npm run dev
```
**Checkpoint:** `curl http://localhost:5000` returns `{"ok":true,...}`.

OAuth setup:
1. Google Cloud Console → create OAuth 2.0 Client (type: Web).
2. Authorized redirect URI: `http://localhost:5000/auth/google/callback`.
3. Enable **YouTube Data API v3**.
4. Create an API key for the public metrics endpoint (restrict to YouTube Data API).

## 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env            # paste contract addresses from step 1
npm run dev
```
**Checkpoint:** `http://localhost:5173` loads the landing page.

## 4. End-to-end smoke test
1. Open `/dashboard` → sign in with Google → Load from YouTube → Bind to wallet on one of your channels.
2. Deploy a ChannelToken for your channel from Hardhat:
   ```bash
   cd contracts
   npx hardhat console --network mumbai
   > const F = await ethers.getContractFactory("ChannelToken")
   > const t = await F.deploy("My Coin","MC","UCxxxxx","0xYourWallet",ethers.parseUnits("1000000",18),ethers.parseUnits("10000",18))
   > await t.getAddress()
   ```
3. Paste the address into the dashboard.
4. Approve the marketplace, list tokens, buy from a second MetaMask account.
5. Create a milestone challenge, join from both accounts, wait for resolver (or call `resolve()` manually from Hardhat console) to distribute badges.

## 5. Deploy
- **Frontend** → Vercel, import GitHub repo, set the 4 `VITE_*` env vars.
- **Backend** → Render.com web service, add MongoDB Atlas URI + OAuth keys.
- **Contracts** → already on Polygon Mumbai from step 1 (use `mumbai`).

## 6. Security checklist before demo
- `npx hardhat test` — all green.
- `npm i -g slither-analyzer && slither contracts/` — no HIGH findings.
- `npm audit` in backend and frontend — no HIGH findings.
- Verify contracts on Polygonscan Mumbai (`scripts/verify.js` using `@nomicfoundation/hardhat-verify`).
