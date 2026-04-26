require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  POLYGON_MUMBAI_RPC = "https://rpc-mumbai.maticvigil.com",
  DEPLOYER_PRIVATE_KEY,
  POLYGONSCAN_API_KEY,
} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: { url: "http://127.0.0.1:8545" },
    mumbai: {
      url: POLYGON_MUMBAI_RPC,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      chainId: 80001,
    },
  },
  etherscan: {
    apiKey: { polygonMumbai: POLYGONSCAN_API_KEY || "" },
  },
};
