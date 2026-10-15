import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="pad">
      <h1>페이지를 찾을 수 없습니다</h1>
      <Link to="/">홈으로</Link>
    </div>
  );
}
