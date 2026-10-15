import { ZeroAddress } from "ethers";
import { AddrLink, BlockLink, TxLink } from "./Links";
import { tokenAmount } from "../lib/format";

// focus: 주소 페이지에서 보고 있는 주소. 그 주소 기준으로 IN/OUT을 표시한다.
export function TransferTable({ transfers, token, focus }) {
  const me = focus?.toLowerCase();
  return (
    <div className="table-wrap">
      <table className="list">
        <thead>
          <tr>
            <th>Tx</th>
            <th>블록</th>
            <th>From</th>
            {me && <th />}
            <th>To</th>
            <th className="right">수량</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={`${t.txHash}-${t.logIndex}`}>
              <td>
                <TxLink hash={t.txHash} />
              </td>
              <td>
                <BlockLink number={t.blockNumber} />
              </td>
              <td>{t.from === ZeroAddress ? <span className="tag">Mint</span> : <AddrLink address={t.from} />}</td>
              {me && (
                <td>
                  {t.from.toLowerCase() === me ? (
                    <span className="badge out">OUT</span>
                  ) : (
                    <span className="badge in">IN</span>
                  )}
                </td>
              )}
              <td>{t.to === ZeroAddress ? <span className="tag">Burn</span> : <AddrLink address={t.to} />}</td>
              <td className="right mono">{tokenAmount(t.value, token.decimals, token.symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
