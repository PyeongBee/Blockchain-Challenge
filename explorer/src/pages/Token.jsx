import { useState } from "react";
import { ZeroAddress } from "ethers";
import { useChain } from "../lib/ChainContext";
import { useAsync } from "../lib/useAsync";
import { useTokenTransfers } from "../lib/useTokenTransfers";
import { getTokenBalance } from "../lib/erc20";
import { num, percent, tokenAmount } from "../lib/format";
import { AddrLink } from "../components/Links";
import { Card, Empty, ErrorBox, Fields, Loading } from "../components/ui";
import { TransferTable } from "../components/TransferTable";

const PAGE_SIZE = 25;

export default function Token() {
  const { token, tokenAddress } = useChain();
  const [tab, setTab] = useState("transfers");
  const transfers = useTokenTransfers();
  if (token.status !== "ok") return <Loading text="MTK 컨트랙트 확인 중…" />;
  const { info } = token;

  return (
    <div className="stack">
      <Card title={`${info.name} (${info.symbol})`}>
        <Fields
          rows={[
            ["컨트랙트", <AddrLink address={tokenAddress} full />],
            ["총 발행량", tokenAmount(info.totalSupply, info.decimals, info.symbol)],
            [
              "Decimals",
              info.decimals,
              `화면의 1 ${info.symbol} = 체인에 저장된 정수 10^${info.decimals}. 컨트랙트는 소수를 모른다.`,
            ],
            [
              "조회 범위",
              transfers.data ? `블록 #${transfers.data.fromBlock} ~ 최신` : "…",
              "탐색기는 DB 없이 매번 eth_getLogs로 Transfer 이벤트를 직접 긁어온다. 실제 Etherscan은 이걸 미리 인덱싱해 둔다.",
            ],
          ]}
        />
      </Card>

      <Card
        title={
          <div className="tabs">
            <button className={tab === "transfers" ? "active" : ""} onClick={() => setTab("transfers")}>
              전송 내역
            </button>
            <button className={tab === "holders" ? "active" : ""} onClick={() => setTab("holders")}>
              홀더
            </button>
          </div>
        }
      >
        {transfers.error ? (
          <ErrorBox error={transfers.error} />
        ) : !transfers.data ? (
          <Loading />
        ) : tab === "transfers" ? (
          <Transfers transfers={transfers.data.transfers} info={info} />
        ) : (
          <Holders transfers={transfers.data.transfers} info={info} />
        )}
      </Card>
    </div>
  );
}

function Transfers({ transfers, info }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  if (transfers.length === 0) return <Empty>아직 전송 내역이 없습니다.</Empty>;
  return (
    <>
      <p className="muted small pad-x">총 {num(transfers.length)}건 (Transfer 이벤트 기준, 최신순)</p>
      <TransferTable transfers={transfers.slice(0, limit)} token={info} />
      {limit < transfers.length && (
        <button className="more" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          더 보기
        </button>
      )}
    </>
  );
}

// 로그에서 한 번이라도 등장한 주소를 모은 뒤, 잔액은 balanceOf로 컨트랙트에 직접 물어본다
function Holders({ transfers, info }) {
  const { provider, tokenAddress, latest } = useChain();
  const { data, error } = useAsync(async () => {
    const addresses = new Set();
    for (const t of transfers) {
      if (t.from !== ZeroAddress) addresses.add(t.from);
      if (t.to !== ZeroAddress) addresses.add(t.to);
    }
    const rows = await Promise.all(
      [...addresses].map(async (address) => ({
        address,
        balance: await getTokenBalance(provider, tokenAddress, address),
      }))
    );
    return rows.filter((r) => r.balance > 0n).sort((a, b) => (b.balance > a.balance ? 1 : -1));
  }, [provider, tokenAddress, transfers, latest]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  if (data.length === 0) return <Empty>잔액을 가진 주소가 없습니다.</Empty>;
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>#</th>
            <th>주소</th>
            <th className="right">잔액</th>
            <th className="right">비율</th>
          </tr>
        </thead>
        <tbody>
          {data.map((h, i) => (
            <tr key={h.address}>
              <td className="muted">{i + 1}</td>
              <td>
                <AddrLink address={h.address} full />
              </td>
              <td className="right mono">{tokenAmount(h.balance, info.decimals, info.symbol)}</td>
              <td className="right">
                <div className="bar-cell">
                  <span>{percent(h.balance, info.totalSupply)}</span>
                  <span className="bar">
                    <span style={{ width: percent(h.balance, info.totalSupply) }} />
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
