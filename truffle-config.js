require('dotenv').config({ path: '.env.sepolia' });
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
    networks: {
      development: {
        host: "127.0.0.1", // Localhost (default: none)
        port: 7545, // Standard Ganache port (default: none)
        network_id: "*", // Any network (default: none)
        gas: 6721975, // Gas limit
        gasPrice: 20000000000, // 20 gwei (in wei)
      },
      ganache: {
        host: "127.0.0.1",
        port: 7545, // Standard Ganache CLI port
        network_id: "*",
        gas: 6721975,
        gasPrice: 20000000000,
      },
      sepolia: {
        provider: () => new HDWalletProvider({
          privateKeys: [process.env.NEXT_PUBLIC_PRIVATE_KEY],
          providerOrUrl: process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL
        }),
        network_id: 11155111,
        gas: 5500000,
        confirmations: 2,
        timeoutBlocks: 200,
        skipDryRun: true
      }
    },
  
    // Set default mocha options here, use special reporters etc.
    mocha: {
      timeout: 100000,
    },
  
    // Configure your compilers
    compilers: {
      solc: {
        version: "0.8.20", // Fetch exact version from solc-bin
        settings: {
          // See the solidity docs for advice about optimization and evmVersion
          optimizer: {
            enabled: true,
            runs: 200,
          },
          evmVersion: "byzantium",
        },
      },
    },
  
    // Truffle DB is currently disabled by default; to enable it, change enabled:
    // false to enabled: true. The default storage location can also be
    // overridden by specifying the adapter settings, as shown in the commented code below.
    //
    // NOTE: It is not possible to migrate your contracts to truffle DB and you should
    // make a backup of your artifacts to a safe location before enabling this feature.
    //
    // After you backed up your artifacts you can utilize db by running migrate as follows:
    // $ truffle migrate --reset --compile-all
    //
    // db: {
    //   enabled: false,
    //   host: "127.0.0.1",
    //   adapter: {
    //     name: "sqlite",
    //     settings: {
    //       directory: ".db"
    //     }
    //   }
    // }
  
    plugins: ["truffle-plugin-verify"],
    paths: {
      sources: "./contracts",
      tests: "./test",
      cache: "./cache",
      artifacts: "./artifacts"
    }
  }
  