import { useEffect, useState } from "react";

// deps가 바뀌면 fn을 다시 실행한다. 다시 불러오는 동안에는 이전 data를 그대로 보여줘서 깜빡임을 막는다.
export function useAsync(fn, deps) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => !cancelled && setState({ loading: false, data, error: null }),
      (error) => !cancelled && setState({ loading: false, data: null, error })
    );
    return () => {
      cancelled = true;
    };
  }, deps);

  return state;
}
