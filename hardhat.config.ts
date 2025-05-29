import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config({ path: '.env.sepolia' });

const config = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "byzantium",
    },
  },
  networks: {
    sepolia: {
      url: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "",
      accounts: process.env.NEXT_PUBLIC_PRIVATE_KEY ? [process.env.NEXT_PUBLIC_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
    hardhat: {
      chainId: 31337,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
} as const;

export default config; 