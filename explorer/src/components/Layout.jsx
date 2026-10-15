import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { isAddress } from "ethers";
import { useChain } from "../lib/ChainContext";
import { chainName } from "../lib/provider";
import { shortHash } from "../lib/format";

export default function Layout() {
  const chain = useChain();
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="logo">◆</span> MTK Explorer
          </Link>
          <SearchBar />
          <Status />
        </div>
      </header>
      <main className="container">
        <Settings />
        <TokenNotice />
        {chain.status === "connected" ? (
          <Outlet />
        ) : chain.status === "connecting" ? (
          <p className="muted pad">{chain.rpcUrl} 에 연결 중…</p>
        ) : (
          <ConnectError />
        )}
      </main>
    </>
  );
}

function SearchBar() {
  const { provider } = useChain();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);

  // 입력 모양으로 무엇인지 추측한다: 숫자=블록 번호, 20바이트=주소, 32바이트=tx 해시 또는 블록 해시
  async function onSubmit(e) {
    e.preventDefault();
    const value = q.trim();
    setError(null);
    if (!value) return;
    if (/^\d+$/.test(value)) return go(`/block/${value}`);
    if (isAddress(value)) return go(`/address/${value}`);
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) {
      if (!provider) return setError("RPC에 연결되지 않았습니다");
      const tx = await provider.getTransaction(value).catch(() => null);
      return go(tx ? `/tx/${value}` : `/block/${value}`);
    }
    setError("블록 번호, tx 해시, 주소 중 하나를 입력하세요");
  }

  function go(path) {
    setQ("");
    navigate(path);
  }

  return (
    <form className="search" onSubmit={onSubmit}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="주소 / Tx 해시 / 블록 번호"
        spellCheck={false}
        aria-label="검색"
      />
      {error && <div className="search-error">{error}</div>}
    </form>
  );
}

function Status() {
  const { status, chainId, latest } = useChain();
  if (status !== "connected") {
    return <span className={`status ${status}`}>{status === "connecting" ? "연결 중" : "연결 끊김"}</span>;
  }
  return (
    <span className="status connected" title={`chainId ${chainId}`}>
      <span className="dot" /> {chainName(chainId)} · #{latest ?? "…"}
    </span>
  );
}

function Settings() {
  const { rpcUrl, setRpcUrl, tokenAddress, setTokenAddress } = useChain();
  const [rpc, setRpc] = useState(rpcUrl);
  const [tokenAddr, setTokenAddr] = useState(tokenAddress);

  function onSubmit(e) {
    e.preventDefault();
    if (rpc.trim() !== rpcUrl) setRpcUrl(rpc.trim());
    if (tokenAddr.trim() !== tokenAddress) setTokenAddress(tokenAddr.trim());
  }

  return (
    <details className="settings">
      <summary>
        ⚙ 설정 <span className="muted mono">{rpcUrl} · MTK {shortHash(tokenAddress, 6, 4)}</span>
      </summary>
      <form onSubmit={onSubmit}>
        <label>
          RPC URL
          <input value={rpc} onChange={(e) => setRpc(e.target.value)} spellCheck={false} />
        </label>
        <label>
          MTK 컨트랙트 주소
          <input value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value)} spellCheck={false} />
        </label>
        <button type="submit">적용</button>
      </form>
    </details>
  );
}

function TokenNotice() {
  const { status, token, tokenAddress } = useChain();
  if (status !== "connected" || token.status === "ok" || token.status === "loading") return null;
  const reason = {
    invalid: "MTK 컨트랙트 주소 형식이 올바르지 않습니다.",
    missing: `${tokenAddress} 에 배포된 컨트랙트가 없습니다. (노드를 재시작하면 체인이 초기화됩니다)`,
    "not-erc20": `${tokenAddress} 는 ERC-20처럼 응답하지 않습니다.`,
  }[token.status];
  return (
    <div className="notice">
      <strong>MTK를 찾지 못했습니다.</strong> {reason}
      <br />
      <code>cd token && npm run deploy:localhost</code> 로 배포한 뒤, 출력된 주소가 다르면 ⚙ 설정에
      입력하세요. 배포되면 자동으로 감지합니다.
    </div>
  );
}

function ConnectError() {
  const { rpcUrl, error, reconnect } = useChain();
  return (
    <div className="notice error-notice">
      <strong>{rpcUrl} 에 연결할 수 없습니다.</strong>
      <p className="muted">{error?.message}</p>
      <p>
        로컬 노드가 켜져 있는지 확인하세요: <code>cd token && npm run node</code>
      </p>
      <button onClick={reconnect}>다시 연결</button>
    </div>
  );
}
