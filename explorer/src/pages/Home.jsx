import { Link } from "react-router-dom";
import { useChain } from "../lib/ChainContext";
import { useAsync } from "../lib/useAsync";
import { useTokenTransfers } from "../lib/useTokenTransfers";
import { num, shortHash, timeAgo, tokenAmount, eth } from "../lib/format";
import { decodeInput } from "../lib/erc20";
import { AddrLink, BlockLink, TxLink } from "../components/Links";
import { Card, Empty, ErrorBox, Loading } from "../components/ui";
import { TransferTable } from "../components/TransferTable";

const BLOCK_COUNT = 8;

export default function Home() {
  const transfers = useTokenTransfers();
  const blocks = useLatestBlocks();
  return (
    <div className="stack">
      <TokenSummary transfers={transfers} />
      <RecentTransfers transfers={transfers} />
      <div className="grid-2">
        <LatestBlocks blocks={blocks} />
        <LatestTxs blocks={blocks} />
      </div>
    </div>
  );
}

function TokenSummary({ transfers: { data } }) {
  const { token, tokenAddress } = useChain();
  if (token.status !== "ok") return null;
  const { info } = token;

  const holders = data && countHolders(data.transfers);
  return (
    <section className="hero">
      <div>
        <div className="hero-label">ERC-20 Token</div>
        <h1>
          {info.name} <span className="muted">({info.symbol})</span>
        </h1>
        <AddrLink address={tokenAddress} full />
      </div>
      <div className="stats">
        <Stat label="총 발행량" value={tokenAmount(info.totalSupply, info.decimals, info.symbol)} />
        <Stat label="Decimals" value={info.decimals} />
        <Stat label="홀더" value={holders ?? "…"} to="/token" />
        <Stat label="전송 횟수" value={data ? num(data.transfers.length) : "…"} to="/token" />
      </div>
    </section>
  );
}

// 받은 적은 있지만 전부 보내버린 주소도 포함되므로 "잔액 > 0" 홀더 수는 로그만으로 직접 계산한다
function countHolders(transfers) {
  const balances = new Map();
  for (const t of transfers) {
    balances.set(t.from, (balances.get(t.from) ?? 0n) - t.value);
    balances.set(t.to, (balances.get(t.to) ?? 0n) + t.value);
  }
  return [...balances.entries()].filter(([addr, bal]) => !/^0x0{40}$/.test(addr) && bal > 0n).length;
}

function Stat({ label, value, to }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </>
  );
  return to ? (
    <Link className="stat link" to={to}>
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

function RecentTransfers({ transfers: { data, error } }) {
  const { token } = useChain();
  if (token.status !== "ok") return null;
  return (
    <Card
      title={`최근 ${token.info.symbol} 전송`}
      actions={
        <Link to="/token" className="small">
          전체 보기 →
        </Link>
      }
    >
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : data.transfers.length === 0 ? (
        <Empty>아직 전송 내역이 없습니다.</Empty>
      ) : (
        <TransferTable transfers={data.transfers.slice(0, 10)} token={token.info} />
      )}
    </Card>
  );
}

function useLatestBlocks() {
  const { provider, latest } = useChain();
  return useAsync(async () => {
    if (latest == null) return null;
    const numbers = [];
    for (let n = latest; n >= 0 && numbers.length < BLOCK_COUNT; n--) numbers.push(n);
    // 두 번째 인자 true = tx 해시만이 아니라 tx 본문까지 같이 받기
    return Promise.all(numbers.map((n) => provider.getBlock(n, true)));
  }, [provider, latest]);
}

function LatestBlocks({ blocks: { data, error } }) {
  return (
    <Card title="최근 블록">
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <ul className="feed">
          {data.map((b) => (
            <li key={b.hash}>
              <div className="feed-icon">Bk</div>
              <div className="feed-main">
                <BlockLink number={b.number} />
                <div className="muted small">{timeAgo(b.timestamp)}</div>
              </div>
              <div className="feed-side">
                <div className="small mono muted">{shortHash(b.hash)}</div>
                <div className="small">{b.transactions.length} txs</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LatestTxs({ blocks: { data, error } }) {
  const txs = data?.flatMap((b) => b.prefetchedTransactions).slice(0, BLOCK_COUNT);
  return (
    <Card title="최근 트랜잭션">
      {error ? (
        <ErrorBox error={error} />
      ) : !txs ? (
        <Loading />
      ) : txs.length === 0 ? (
        <Empty>최근 블록에 트랜잭션이 없습니다.</Empty>
      ) : (
        <ul className="feed">
          {txs.map((tx) => {
            const decoded = tx.to && decodeInput(tx.data);
            return (
              <li key={tx.hash}>
                <div className="feed-icon">Tx</div>
                <div className="feed-main">
                  <TxLink hash={tx.hash} />
                  <div className="small">
                    <AddrLink address={tx.from} /> → {tx.to ? <AddrLink address={tx.to} /> : <span className="tag">배포</span>}
                  </div>
                </div>
                <div className="feed-side">
                  {decoded ? (
                    <span className="tag">{decoded.name ?? decoded.selector}</span>
                  ) : (
                    <span className="small">{eth(tx.value)}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
