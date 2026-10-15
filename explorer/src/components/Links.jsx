import { Link } from "react-router-dom";
import { shortHash } from "../lib/format";
import { useChain } from "../lib/ChainContext";

export function BlockLink({ number }) {
  return <Link to={`/block/${number}`}>{Number(number).toLocaleString("en-US")}</Link>;
}

export function TxLink({ hash, full = false }) {
  return (
    <Link className="mono" to={`/tx/${hash}`} title={hash}>
      {full ? hash : shortHash(hash)}
    </Link>
  );
}

export function AddrLink({ address, full = false }) {
  const { tokenAddress, token } = useChain();
  if (!address) return <span className="muted">-</span>;
  const isToken = address.toLowerCase() === tokenAddress.toLowerCase();
  return (
    <Link className="mono" to={`/address/${address}`} title={address}>
      {full ? address : shortHash(address, 8, 6)}
      {isToken && token.info && <span className="tag">{token.info.symbol}</span>}
    </Link>
  );
}
