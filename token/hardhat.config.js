require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// .env 파일이 없거나 값이 비어있어도 로컬 컴파일/테스트는 깨지지 않도록 안전한 기본값을 둡니다.
// 실제 테스트넷 배포 시에는 .env에 진짜 값을 채워야 합니다.
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const ARBITRUM_SEPOLIA_RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // npx hardhat test / 기본 명령은 이 임시(in-memory) 네트워크를 씁니다. 꺼지면 상태가 전부 초기화됨.
    hardhat: {},

    // Polygon의 테스트넷 (예전 Mumbai 대체)
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },

    // 이더리움의 테스트넷
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },

    // Arbitrum(L2)의 테스트넷
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 421614,
    },
  },
  etherscan: {
    // Etherscan v2 통합 API로 대부분의 EVM 체인 익스플로러를 하나의 키로 처리합니다.
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
