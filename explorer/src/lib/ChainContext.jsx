import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { isAddress } from "ethers";
import { connect, loadRpcUrl, loadTokenAddress, saveRpcUrl, saveTokenAddress } from "./provider";
import { getTokenInfo } from "./erc20";

const POLL_MS = 2000;
const ChainContext = createContext(null);

export function ChainProvider({ children }) {
  const [rpcUrl, setRpcUrlState] = useState(loadRpcUrl);
  const [tokenAddress, setTokenAddressState] = useState(loadTokenAddress);
  const [retry, setRetry] = useState(0);
  const [conn, setConn] = useState({ status: "connecting", provider: null, chainId: null, error: null });
  const [latest, setLatest] = useState(null);
  const [token, setToken] = useState({ status: "loading", info: null });

  useEffect(() => {
    let cancelled = false;
    let timer;
    let provider;
    setConn({ status: "connecting", provider: null, chainId: null, error: null });
    setLatest(null);

    connect(rpcUrl)
      .then(({ provider: p, chainId }) => {
        if (cancelled) return p.destroy();
        provider = p;
        setConn({ status: "connected", provider: p, chainId, error: null });

        // 새 블록이 생겼는지 주기적으로 확인 — 입금 스캐너의 "head 추적"과 같은 원리
        const poll = async () => {
          try {
            const n = await p.getBlockNumber();
            if (!cancelled) setLatest(n);
          } catch {
            // 일시적인 RPC 오류는 다음 폴링에서 회복
          }
        };
        poll();
        timer = setInterval(poll, POLL_MS);
      })
      .catch((error) => {
        if (!cancelled) setConn({ status: "error", provider: null, chainId: null, error });
      });

    return () => {
      cancelled = true;
      clearInterval(timer);
      provider?.destroy();
    };
  }, [rpcUrl, retry]);

  // 토큰 컨트랙트가 실제로 있는지 / ERC-20으로 응답하는지 확인.
  // 노드를 재시작하면 체인이 초기화돼서 같은 주소에 코드가 없을 수 있으므로,
  // 확인되기 전까지는 새 블록이 생길 때마다 다시 본다.
  const recheckKey = token.status === "ok" ? null : latest;
  useEffect(() => {
    const { provider } = conn;
    if (!provider) return;
    if (!isAddress(tokenAddress)) {
      setToken({ status: "invalid", info: null });
      return;
    }
    let cancelled = false;
    (async () => {
      const code = await provider.getCode(tokenAddress);
      if (code === "0x") return { status: "missing", info: null };
      const info = await getTokenInfo(provider, tokenAddress);
      return info ? { status: "ok", info } : { status: "not-erc20", info: null };
    })()
      .then((t) => !cancelled && setToken(t))
      .catch(() => !cancelled && setToken({ status: "missing", info: null }));
    return () => {
      cancelled = true;
    };
  }, [conn, tokenAddress, recheckKey]);

  const setRpcUrl = useCallback((url) => {
    saveRpcUrl(url);
    setRpcUrlState(url);
    setRetry((r) => r + 1);
  }, []);

  const setTokenAddress = useCallback((address) => {
    saveTokenAddress(address);
    setTokenAddressState(address);
    setToken({ status: "loading", info: null });
  }, []);

  const value = {
    ...conn,
    rpcUrl,
    setRpcUrl,
    latest,
    tokenAddress,
    setTokenAddress,
    token,
    reconnect: () => setRetry((r) => r + 1),
  };
  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain() {
  return useContext(ChainContext);
}
