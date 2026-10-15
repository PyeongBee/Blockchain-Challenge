import { useChain } from "./ChainContext";
import { useAsync } from "./useAsync";
import { getTransfers } from "./erc20";
import { logFromBlock } from "./provider";

// MTK의 Transfer 로그 전체(조회 범위 안). 새 블록이 생기면 다시 조회한다.
// filter: { from, to } — 특정 주소가 보내거나 받은 것만
export function useTokenTransfers(filter = {}) {
  const { provider, latest, tokenAddress, token } = useChain();
  const ready = token.status === "ok" && latest != null;
  return useAsync(async () => {
    if (!ready) return null;
    const fromBlock = logFromBlock(latest);
    const opts = { fromBlock, toBlock: latest };
    if (filter.account) {
      // topics는 AND 조건이라 "from이거나 to"는 쿼리 두 번으로 나눠서 합친다
      const [sent, received] = await Promise.all([
        getTransfers(provider, tokenAddress, { ...opts, from: filter.account }),
        getTransfers(provider, tokenAddress, { ...opts, to: filter.account }),
      ]);
      const seen = new Set();
      const merged = [...sent, ...received].filter((t) => {
        const key = `${t.txHash}-${t.logIndex}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      merged.sort((a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex);
      return { transfers: merged, fromBlock };
    }
    return { transfers: await getTransfers(provider, tokenAddress, opts), fromBlock };
  }, [provider, latest, tokenAddress, ready, filter.account]);
}
