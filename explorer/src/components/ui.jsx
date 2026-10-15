import { stringify } from "../lib/format";

// [라벨, 값, (선택) 학습용 설명 한 줄] 배열을 표로 그린다
export function Fields({ rows }) {
  return (
    <dl className="fields">
      {rows.filter(Boolean).map(([label, value, hint]) => (
        <div className="field" key={label}>
          <dt>{label}</dt>
          <dd>
            <div className="value">{value}</div>
            {hint && <div className="hint">{hint}</div>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({ title, actions, children }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <h2>{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Loading({ text = "불러오는 중…" }) {
  return <p className="muted pad">{text}</p>;
}

export function ErrorBox({ error }) {
  return <p className="error pad">⚠ {error?.shortMessage || error?.message || String(error)}</p>;
}

export function Empty({ children }) {
  return <p className="muted pad">{children}</p>;
}

export function Badge({ kind, children }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function DecodedArgs({ args, render }) {
  return (
    <div className="table-wrap">
      <table className="args">
        <tbody>
          {args.map((a, i) => (
            <tr key={i}>
              <td className="muted">{i}</td>
              <td>
                {a.name} {a.indexed && <span className="tag">indexed</span>}
              </td>
              <td className="muted mono">{a.type}</td>
              <td className="mono wrap">{render ? render(a) : stringify(a.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
