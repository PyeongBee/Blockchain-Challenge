import { Contract, Interface, zeroPadValue } from "ethers";

// 탐색기가 "읽을 줄 아는" ABI. 여기 없는 함수/이벤트는 셀렉터(앞 4바이트)만 보여준다.
// MyToken은 OpenZeppelin ERC20을 그대로 상속하므로 이 표준 ABI로 전부 해석된다.
export const erc20 = new Interface([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

// keccak256("Transfer(address,address,uint256)") — 입금 감지 스캐너가 getLogs로 거르는 바로 그 값
export const TRANSFER_TOPIC = erc20.getEvent("Transfer").topicHash;

export function decodeInput(data) {
  if (!data || data === "0x") return null;
  const selector = data.slice(0, 10);
  try {
    const parsed = erc20.parseTransaction({ data });
    if (!parsed) return { selector };
    return {
      selector,
      name: parsed.name,
      signature: parsed.signature,
      args: parsed.fragment.inputs.map((input, i) => ({
        name: input.name,
        type: input.type,
        value: parsed.args[i],
      })),
    };
  } catch {
    return { selector };
  }
}

export function decodeLog(log) {
  try {
    const parsed = erc20.parseLog({ topics: [...log.topics], data: log.data });
    if (!parsed) return null;
    return {
      name: parsed.name,
      signature: parsed.signature,
      args: parsed.fragment.inputs.map((input, i) => ({
        name: input.name,
        type: input.type,
        indexed: input.indexed,
        value: parsed.args[i],
      })),
    };
  } catch {
    // topic 개수가 다른 ERC-721 Transfer 등은 여기로 온다
    return null;
  }
}

const tokenCache = new Map();

// 컨트랙트가 ERC-20처럼 응답하면 {name, symbol, decimals, totalSupply}, 아니면 null
export function getTokenInfo(provider, address) {
  const key = address.toLowerCase();
  if (!tokenCache.has(key)) {
    const token = new Contract(address, erc20, provider);
    const info = Promise.all([token.name(), token.symbol(), token.decimals(), token.totalSupply()])
      .then(([name, symbol, decimals, totalSupply]) => ({
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply,
      }))
      .catch(() => null);
    tokenCache.set(key, info);
  }
  return tokenCache.get(key);
}

export function getTokenBalance(provider, token, owner) {
  return new Contract(token, erc20, provider).balanceOf(owner);
}

export function addressTopic(address) {
  return zeroPadValue(address, 32);
}

// fromBlock~latest 구간의 Transfer 로그를 최신순으로. from/to를 주면 그 주소가 관련된 것만.
// 입금 스캐너가 하는 일과 똑같다: "이 컨트랙트(address)의 Transfer(topic0) 중 to(topic2)가 우리 주소인 것"
export async function getTransfers(provider, token, { fromBlock, toBlock = "latest", from, to } = {}) {
  const topics = [TRANSFER_TOPIC, from ? addressTopic(from) : null, to ? addressTopic(to) : null];
  const logs = await provider.getLogs({ address: token, topics, fromBlock, toBlock });
  return logs
    .map((log) => {
      const decoded = decodeLog(log);
      if (!decoded) return null;
      const [f, t, value] = decoded.args.map((a) => a.value);
      return {
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
        from: f,
        to: t,
        value,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
}
