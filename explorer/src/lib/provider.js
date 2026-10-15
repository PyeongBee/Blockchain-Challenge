import { JsonRpcProvider, Network } from "ethers";

const STORAGE_KEY = "explorer.rpcUrl";
export const DEFAULT_RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export function loadRpcUrl() {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_RPC_URL;
  } catch {
    return DEFAULT_RPC_URL;
  }
}

export function saveRpcUrl(url) {
  try {
    localStorage.setItem(STORAGE_KEY, url);
  } catch {
    // 저장소를 못 쓰는 환경이면 이번 세션에서만 유지
  }
}

// ethers의 JsonRpcProvider는 노드가 꺼져 있으면 네트워크 감지를 무한 재시도하면서 콘솔을 도배한다.
// 그래서 eth_chainId를 직접 한 번 호출해 노드가 살아있는지 먼저 확인하고,
// 알아낸 chainId를 staticNetwork로 고정해서 provider를 만든다.
export async function connect(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  });
  if (!res.ok) throw new Error(`RPC 응답 오류: HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);

  const chainId = BigInt(json.result);
  const provider = new JsonRpcProvider(url, Network.from(chainId), {
    staticNetwork: true,
    pollingInterval: 2000,
  });
  return { provider, chainId };
}

const CHAIN_NAMES = {
  1: "Ethereum Mainnet",
  31337: "Hardhat Local",
  80002: "Polygon Amoy",
  11155111: "Sepolia",
  421614: "Arbitrum Sepolia",
};

export function chainName(chainId) {
  return CHAIN_NAMES[Number(chainId)] ?? `Chain ${chainId}`;
}

const TOKEN_KEY = "explorer.tokenAddress";

// Hardhat 로컬 노드를 새로 띄우고 account #0이 처음 배포하면 항상 이 주소가 나온다
// (컨트랙트 주소 = keccak(rlp(배포자, nonce)) 이고 배포자·nonce=0이 매번 같기 때문)
export const DEFAULT_TOKEN_ADDRESS =
  import.meta.env.VITE_TOKEN_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export function loadTokenAddress() {
  try {
    return localStorage.getItem(TOKEN_KEY) || DEFAULT_TOKEN_ADDRESS;
  } catch {
    return DEFAULT_TOKEN_ADDRESS;
  }
}

export function saveTokenAddress(address) {
  try {
    localStorage.setItem(TOKEN_KEY, address);
  } catch {
    // 이번 세션에서만 유지
  }
}

export const TX_SCAN_BLOCKS = Number(import.meta.env.VITE_TX_SCAN_BLOCKS) || 100;
export const LOG_SCAN_BLOCKS = Number(import.meta.env.VITE_LOG_SCAN_BLOCKS) || 10000;

export function logFromBlock(latest) {
  return Math.max(0, latest - LOG_SCAN_BLOCKS);
}
