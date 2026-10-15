import { useParams } from "react-router-dom";
import { useChain } from "../lib/ChainContext";
import { useAsync } from "../lib/useAsync";
import { decodeInput, decodeLog } from "../lib/erc20";
import { eth, gwei, num, percent, stringify, tokenAmount } from "../lib/format";
import { AddrLink, BlockLink } from "../components/Links";
import { Badge, Card, DecodedArgs, Empty, ErrorBox, Fields, Loading } from "../components/ui";

const TX_TYPES = { 0: "0 (Legacy)", 1: "1 (EIP-2930)", 2: "2 (EIP-1559)", 3: "3 (EIP-4844 Blob)", 4: "4 (EIP-7702)" };

export default function Tx() {
  const { hash } = useParams();
  const { provider, latest, tokenAddress, token } = useChain();

  // 블록에 포함되기 전(pending)이면 receipt가 없으므로, 새 블록이 생길 때마다 다시 조회한다
  const { data, error, loading } = useAsync(async () => {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(hash),
      provider.getTransactionReceipt(hash),
    ]);
    const block = receipt ? await provider.getBlock(receipt.blockNumber) : null;
    return { tx, receipt, block };
  }, [provider, hash, latest]);

  if (error) return <ErrorBox error={error} />;
  if (loading && !data) return <Loading />;
  if (!data?.tx) return <Empty>트랜잭션 {hash} 을(를) 찾을 수 없습니다.</Empty>;

  const { tx, receipt, block } = data;
  const isMtk = (addr) => token.info && addr?.toLowerCase() === tokenAddress.toLowerCase();
  const fmtArg = (contract) => (a) =>
    a.type === "uint256" && isMtk(contract)
      ? `${tokenAmount(a.value, token.info.decimals, token.info.symbol)}  (raw ${a.value})`
      : a.type === "address"
        ? <AddrLink address={a.value} full />
        : stringify(a.value);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>트랜잭션</h1>
        <span className="mono wrap muted">{tx.hash}</span>
      </div>
      <Card title="Transaction — 내가 서명해서 보낸 내용">
        <Fields
          rows={[
            [
              "상태",
              !receipt ? (
                <Badge kind="pending">대기 중 (Pending)</Badge>
              ) : receipt.status === 1 ? (
                <Badge kind="ok">성공</Badge>
              ) : (
                <Badge kind="fail">실패 (Revert)</Badge>
              ),
              "status는 Receipt에만 있다. 실패해도 블록에는 포함되고 가스비는 나간다.",
            ],
            ["From", <AddrLink address={tx.from} full />],
            [
              "To",
              tx.to ? <AddrLink address={tx.to} full /> : <span className="tag">컨트랙트 생성</span>,
              isMtk(tx.to) && "MTK 전송인데 to가 받는 사람이 아니라 토큰 컨트랙트다. 실제 수신자는 data 안에 들어있다.",
            ],
            ["Value", eth(tx.value), tx.value === 0n && tx.data !== "0x" && "토큰 전송이면 ETH는 0이다."],
            ["Nonce", tx.nonce, "보낸 사람의 몇 번째 tx인지. 같은 nonce로는 하나만 체인에 들어간다."],
            ["Type", TX_TYPES[tx.type] ?? tx.type],
            ["Chain ID", tx.chainId.toString(), "서명에 포함돼서 다른 체인에서 재사용(replay)할 수 없다."],
            ["Gas Limit", num(tx.gasLimit)],
            tx.maxFeePerGas != null && ["Max Fee", gwei(tx.maxFeePerGas), "가스 1단위당 최대로 낼 의향이 있는 가격"],
            tx.maxPriorityFeePerGas != null && ["Max Priority Fee", gwei(tx.maxPriorityFeePerGas), "검증자에게 주는 팁 상한"],
            tx.type < 2 && ["Gas Price", gwei(tx.gasPrice)],
            [
              "서명 (v, r, s)",
              <div className="mono wrap small">
                <div>v = {tx.signature.v} (yParity {tx.signature.yParity})</div>
                <div>r = {tx.signature.r}</div>
                <div>s = {tx.signature.s}</div>
              </div>,
              "from 필드는 tx 안에 없다. 노드가 이 서명에서 공개키를 복원해 주소를 계산한다.",
            ],
          ]}
        />
      </Card>

      {receipt && (
        <Card title="Receipt — 실제로 어떻게 처리됐는가">
          <Fields
            rows={[
              ["블록", <BlockLink number={receipt.blockNumber} />],
              [
                "Confirmations",
                latest != null ? latest - receipt.blockNumber + 1 : "…",
                "Hardhat은 tx마다 블록을 하나 만들고(automine) 그 위로 블록이 안 쌓이면 이 값은 그대로다.",
              ],
              ["Tx Index", receipt.index, "블록 안에서 몇 번째 tx인지"],
              [
                "Gas Used",
                `${num(receipt.gasUsed)} / ${num(tx.gasLimit)} (${percent(receipt.gasUsed, tx.gasLimit)})`,
                "남은 가스는 돌려받는다. 실제 소모량은 실행해봐야 알 수 있어서 Receipt에만 있다.",
              ],
              ["Effective Gas Price", gwei(receipt.gasPrice)],
              ["수수료", <FeeBreakdown receipt={receipt} block={block} />],
              receipt.contractAddress && ["생성된 컨트랙트", <AddrLink address={receipt.contractAddress} full />],
            ]}
          />
        </Card>
      )}

      <Card title="Input Data">
        <InputData tx={tx} render={fmtArg(tx.to)} />
      </Card>

      {receipt && (
        <Card title={`Logs (${receipt.logs.length})`}>
          {receipt.logs.length === 0 ? (
            <Empty>이벤트가 없습니다.</Empty>
          ) : (
            receipt.logs.map((log) => <Log key={log.index} log={log} render={fmtArg(log.address)} />)
          )}
        </Card>
      )}
    </div>
  );
}

function FeeBreakdown({ receipt, block }) {
  const fee = receipt.gasUsed * receipt.gasPrice;
  const baseFee = block?.baseFeePerGas;
  if (baseFee == null) return eth(fee);
  const burnt = receipt.gasUsed * baseFee;
  return (
    <div>
      <div>{eth(fee)}</div>
      <div className="muted small">
        = gasUsed × effectiveGasPrice
        <br />
        소각(baseFee × gasUsed): {eth(burnt)} · 검증자 팁: {eth(fee - burnt)}
      </div>
    </div>
  );
}

function InputData({ tx, render }) {
  if (tx.data === "0x") return <Empty>data 없음 — 순수 ETH 전송입니다.</Empty>;
  if (!tx.to) {
    return (
      <div className="pad">
        <p className="hint">컨트랙트 생성 tx는 data에 컴파일된 바이트코드 + 생성자 인자가 들어있다.</p>
        <pre className="raw">{tx.data}</pre>
      </div>
    );
  }
  const decoded = decodeInput(tx.data);
  return (
    <div className="pad">
      {decoded.name ? (
        <>
          <p>
            <span className="tag">{decoded.selector}</span> <span className="mono">{decoded.signature}</span>
          </p>
          <p className="hint">
            앞 4바이트(셀렉터) = keccak256("{decoded.signature}")의 앞 4바이트. 나머지는 인자를 32바이트씩 ABI 인코딩한 값.
          </p>
          <DecodedArgs args={decoded.args} render={render} />
        </>
      ) : (
        <p>
          셀렉터 <span className="tag">{decoded.selector}</span> — 탐색기가 아는 ABI에 없는 함수입니다.
        </p>
      )}
      <details>
        <summary className="small">원본 data 보기</summary>
        <pre className="raw">{splitWords(tx.data)}</pre>
      </details>
    </div>
  );
}

// 0x + 셀렉터(4바이트) + 32바이트 워드들로 줄바꿈해서 ABI 구조가 눈에 보이게
function splitWords(data) {
  const body = data.slice(10);
  const words = body.match(/.{1,64}/g) ?? [];
  return [data.slice(0, 10), ...words.map((w, i) => `[${i}] ${w}`)].join("\n");
}

function Log({ log, render }) {
  const decoded = decodeLog(log);
  return (
    <div className="log">
      <div className="log-head">
        <span className="tag">#{log.index}</span> <AddrLink address={log.address} full />
        {decoded && <span className="mono"> {decoded.signature}</span>}
      </div>
      {decoded && <DecodedArgs args={decoded.args} render={render} />}
      <details>
        <summary className="small">원본 topics / data</summary>
        <pre className="raw">
          {log.topics.map((t, i) => `topic${i}: ${t}${i === 0 ? "  ← 이벤트 시그니처 해시" : ""}`).join("\n")}
          {`\ndata:   ${log.data}`}
        </pre>
        <p className="hint">
          indexed 인자는 topic에 들어가서 eth_getLogs로 필터링할 수 있고, 나머지는 data에 들어간다. 입금 스캐너는
          topic2(to)가 우리 주소인 Transfer를 찾는다.
        </p>
      </details>
    </div>
  );
}
