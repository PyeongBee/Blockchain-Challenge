import { Link, useParams } from "react-router-dom";
import { useChain } from "../lib/ChainContext";
import { useAsync } from "../lib/useAsync";
import { dateTime, eth, gwei, num, percent, timeAgo } from "../lib/format";
import { decodeInput } from "../lib/erc20";
import { AddrLink, TxLink } from "../components/Links";
import { Card, Empty, ErrorBox, Fields, Loading } from "../components/ui";

export default function Block() {
  const { id } = useParams();
  const { provider, latest } = useChain();
  const { data: block, error, loading } = useAsync(
    () => provider.getBlock(/^\d+$/.test(id) ? Number(id) : id, true),
    [provider, id, isFutureBlock(latest, id) ? latest : null]
  );

  if (error) return <ErrorBox error={error} />;
  if (loading && !block) return <Loading />;
  if (!block) return <Empty>블록 {id} 을(를) 찾을 수 없습니다. 아직 생성되지 않았을 수 있습니다.</Empty>;

  const confirmations = latest != null ? latest - block.number + 1 : null;
  return (
    <div className="stack">
      <div className="page-head">
        <h1>블록 #{num(block.number)}</h1>
        <nav className="pager">
          {block.number > 0 && <Link to={`/block/${block.number - 1}`}>← 이전</Link>}
          {latest != null && block.number < latest && <Link to={`/block/${block.number + 1}`}>다음 →</Link>}
        </nav>
      </div>
      <Card>
        <Fields
          rows={[
            ["블록 높이", num(block.number)],
            [
              "Confirmations",
              confirmations,
              "이 블록 위로 쌓인 블록 수(자기 자신 포함). 거래소는 이 값이 N 이상이 돼야 입금을 확정한다.",
            ],
            ["타임스탬프", `${dateTime(block.timestamp)} (${timeAgo(block.timestamp)})`],
            ["트랜잭션", `${block.transactions.length}개`],
            ["Block Hash", <span className="mono wrap">{block.hash}</span>],
            [
              "Parent Hash",
              block.number > 0 ? (
                <Link className="mono wrap" to={`/block/${block.parentHash}`}>
                  {block.parentHash}
                </Link>
              ) : (
                <span className="mono wrap">{block.parentHash}</span>
              ),
              "직전 블록의 해시. 이 연결이 끊기면(부모 해시 불일치) reorg가 일어났다는 뜻이다.",
            ],
            ["Miner (Coinbase)", <AddrLink address={block.miner} full />],
            [
              "Gas Used",
              `${num(block.gasUsed)} / ${num(block.gasLimit)} (${percent(block.gasUsed, block.gasLimit)})`,
            ],
            block.baseFeePerGas != null && [
              "Base Fee",
              gwei(block.baseFeePerGas),
              "EIP-1559 기본 수수료. 블록이 절반 이상 차면 다음 블록에서 오르고, 덜 차면 내려간다. 이 몫은 소각된다.",
            ],
            ["Nonce", <span className="mono">{block.nonce}</span>],
          ]}
        />
      </Card>
      <Card title="트랜잭션">
        {block.prefetchedTransactions.length === 0 ? (
          <Empty>이 블록에는 트랜잭션이 없습니다.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Tx 해시</th>
                  <th>메서드</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="right">Value</th>
                </tr>
              </thead>
              <tbody>
                {block.prefetchedTransactions.map((tx) => {
                  const decoded = tx.to && decodeInput(tx.data);
                  return (
                    <tr key={tx.hash}>
                      <td>
                        <TxLink hash={tx.hash} />
                      </td>
                      <td>{decoded ? <span className="tag">{decoded.name ?? decoded.selector}</span> : <span className="muted">{tx.to ? "전송" : "배포"}</span>}</td>
                      <td>
                        <AddrLink address={tx.from} />
                      </td>
                      <td>{tx.to ? <AddrLink address={tx.to} /> : <span className="tag">컨트랙트 생성</span>}</td>
                      <td className="right mono">{eth(tx.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// 아직 생기지 않은 블록 번호를 보고 있으면 새 블록이 나올 때마다 다시 조회한다
function isFutureBlock(latest, id) {
  return latest == null || (/^\d+$/.test(id) && Number(id) > latest);
}
