import { Link, useParams } from "react-router-dom";
import { getAddress, isAddress } from "ethers";
import { useChain } from "../lib/ChainContext";
import { useAsync } from "../lib/useAsync";
import { useTokenTransfers } from "../lib/useTokenTransfers";
import { getTokenBalance } from "../lib/erc20";
import { TX_SCAN_BLOCKS } from "../lib/provider";
import { eth, tokenAmount } from "../lib/format";
import { AddrLink, BlockLink, TxLink } from "../components/Links";
import { Badge, Card, Empty, ErrorBox, Fields, Loading } from "../components/ui";
import { TransferTable } from "../components/TransferTable";

export default function Address() {
  const { address: param } = useParams();
  if (!isAddress(param)) return <ErrorBox error={`올바른 주소가 아닙니다: ${param}`} />;
  return <AddressView address={getAddress(param)} />;
}

function AddressView({ address }) {
  const { provider, latest, tokenAddress, token } = useChain();
  const isTokenContract = address.toLowerCase() === tokenAddress.toLowerCase();

  const { data, error } = useAsync(async () => {
    const [balance, nonce, code, mtk] = await Promise.all([
      provider.getBalance(address),
      provider.getTransactionCount(address),
      provider.getCode(address),
      token.status === "ok" ? getTokenBalance(provider, tokenAddress, address) : null,
    ]);
    return { balance, nonce, code, mtk };
  }, [provider, address, latest, token.status, tokenAddress]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const isContract = data.code !== "0x";

  return (
    <div className="stack">
      <div className="page-head">
        <h1>
          {isContract ? "컨트랙트" : "주소"} {isTokenContract && token.info && <span className="tag">{token.info.symbol}</span>}
        </h1>
        <span className="mono wrap muted">{address}</span>
      </div>

      {token.info && !isTokenContract && (
        <section className="hero small-hero">
          <div>
            <div className="hero-label">{token.info.symbol} 잔액</div>
            <div className="big mono">{tokenAmount(data.mtk ?? 0n, token.info.decimals, token.info.symbol)}</div>
          </div>
        </section>
      )}

      <Card title="개요">
        <Fields
          rows={[
            ["ETH 잔액", eth(data.balance), "가스비를 내는 네이티브 코인. MTK를 보내려 해도 ETH가 있어야 한다."],
            [
              "종류",
              isContract ? <Badge kind="ok">컨트랙트</Badge> : <Badge kind="neutral">EOA (일반 지갑)</Badge>,
              "eth_getCode 결과가 비어 있으면 EOA, 바이트코드가 있으면 컨트랙트",
            ],
            !isContract && [
              "Nonce",
              data.nonce,
              "이 주소가 지금까지 보낸 tx 수 = 다음 tx에 써야 할 nonce. 받은 tx는 세지 않는다.",
            ],
            isContract && ["바이트코드 크기", `${(data.code.length - 2) / 2} bytes`],
            isTokenContract && ["토큰", <Link to="/token">토큰 페이지에서 홀더/전송 내역 보기 →</Link>],
          ]}
        />
      </Card>

      {token.info && !isTokenContract && <MtkTransfers address={address} />}
      <RecentTxs address={address} />
    </div>
  );
}

function MtkTransfers({ address }) {
  const { token } = useChain();
  const { data, error } = useTokenTransfers({ account: address });
  return (
    <Card title={`${token.info.symbol} 전송 내역`}>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : data.transfers.length === 0 ? (
        <Empty>{token.info.symbol}을 주고받은 기록이 없습니다.</Empty>
      ) : (
        <TransferTable transfers={data.transfers} token={token.info} focus={address} />
      )}
    </Card>
  );
}

// 이더리움 노드에는 "이 주소의 tx 목록" API가 없다. 그래서 최근 블록을 하나씩 열어서 직접 찾는다.
function RecentTxs({ address }) {
  const { provider, latest } = useChain();
  const me = address.toLowerCase();
  const { data, error } = useAsync(async () => {
    if (latest == null) return null;
    const from = Math.max(0, latest - TX_SCAN_BLOCKS + 1);
    const numbers = [];
    for (let n = latest; n >= from; n--) numbers.push(n);
    const blocks = await Promise.all(numbers.map((n) => provider.getBlock(n, true)));
    const txs = blocks.flatMap((b) =>
      b.prefetchedTransactions.filter((tx) => tx.from.toLowerCase() === me || tx.to?.toLowerCase() === me)
    );
    return { txs, from };
  }, [provider, me, latest]);

  return (
    <Card title="트랜잭션">
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading text={`최근 ${TX_SCAN_BLOCKS}개 블록을 스캔하는 중…`} />
      ) : (
        <>
          <p className="hint pad-x">
            블록 #{data.from} ~ #{latest} 범위에서 이 주소가 from/to인 tx. MTK를 받기만 한 주소는 여기 안 나온다 —
            그 tx의 to는 토큰 컨트랙트이기 때문. 노드는 주소별 tx 목록을 주지 않아서, 실제 탐색기는 모든 블록을 미리
            인덱싱해 DB에 저장해 둔다.
          </p>
          {data.txs.length === 0 ? (
            <Empty>이 범위에는 트랜잭션이 없습니다.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="list">
                <thead>
                  <tr>
                    <th>Tx 해시</th>
                    <th>블록</th>
                    <th>From</th>
                    <th />
                    <th>To</th>
                    <th className="right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.txs.map((tx) => (
                    <tr key={tx.hash}>
                      <td>
                        <TxLink hash={tx.hash} />
                      </td>
                      <td>
                        <BlockLink number={tx.blockNumber} />
                      </td>
                      <td>
                        <AddrLink address={tx.from} />
                      </td>
                      <td>
                        {tx.from.toLowerCase() === me ? (
                          <span className="badge out">OUT</span>
                        ) : (
                          <span className="badge in">IN</span>
                        )}
                      </td>
                      <td>{tx.to ? <AddrLink address={tx.to} /> : <span className="tag">컨트랙트 생성</span>}</td>
                      <td className="right mono">{eth(tx.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
