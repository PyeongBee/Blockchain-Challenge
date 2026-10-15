# MTK Explorer

로컬 Hardhat 노드(또는 테스트넷)에 RPC로 직접 붙어서 MTK 토큰과 블록/트랜잭션을 보여주는 React 체인 탐색기.
백엔드나 DB 없이 브라우저가 노드에 JSON-RPC를 바로 호출한다.

## 실행

```sh
# 1) 노드 + 토큰 배포 (token/ 에서)
cd token
npm run node                 # 터미널 1
npm run deploy:localhost     # 터미널 2
npm run transfer:localhost   # 전송 내역 만들기 (선택)

# 2) 탐색기 (explorer/ 에서)
cd explorer
npm install                  # 처음 한 번만
npm run dev                  # http://localhost:5173
```

노드를 새로 띄우고 처음 배포하면 MTK 주소는 항상 `0x5FbDB2315678afecb367f032d93F642f64180aa3`라서 따로 설정할 필요가 없다.
주소가 다르거나 테스트넷을 보려면 화면 상단 **⚙ 설정**에서 RPC URL과 컨트랙트 주소를 바꾸거나 `.env.example`을 `.env`로 복사해서 수정한다.

## 화면

| 경로 | 내용 |
| --- | --- |
| `/` | MTK 요약(발행량·홀더·전송 수), 최근 MTK 전송, 최근 블록/트랜잭션 |
| `/token` | MTK 전체 전송 내역, 홀더 순위 |
| `/block/:번호 또는 해시` | 블록 헤더(부모 해시, baseFee, confirmations), 포함된 tx |
| `/tx/:해시` | Transaction vs Receipt 비교, 수수료(소각/팁) 분해, input data와 로그 ABI 디코딩 |
| `/address/:주소` | ETH·MTK 잔액, nonce, EOA/컨트랙트 구분, MTK 입출금 내역, 최근 tx |

상단 검색창에는 블록 번호, tx 해시, 주소를 넣을 수 있다.

## 어떻게 데이터를 가져오나

| 화면에 보이는 것 | RPC 호출 |
| --- | --- |
| 최신 블록 번호 | 2초마다 `eth_blockNumber` 폴링 |
| MTK 전송 내역 / 홀더 | `eth_getLogs` (address=MTK, topic0=Transfer) → 등장한 주소마다 `balanceOf` |
| 주소의 MTK 입출금 | `eth_getLogs`를 topic1(from), topic2(to)로 한 번씩 조회해서 합침 |
| 주소의 tx 목록 | 최근 N개 블록을 `eth_getBlockByNumber(n, true)`로 열어서 직접 찾음 |

노드에는 "이 주소의 tx 목록" 같은 API가 없다. 그래서 이 탐색기는 매번 로그와 블록을 직접 긁어오고,
조회 범위도 제한해 둔다(`VITE_LOG_SCAN_BLOCKS`, `VITE_TX_SCAN_BLOCKS`).
Etherscan 같은 실제 탐색기는 모든 블록을 미리 인덱싱해 DB에 넣어 둔다. Stage 2 블록 스캐너가 하는 일이 바로 이것이다.

## 구조

```
src/
├── lib/
│   ├── provider.js          # RPC 연결, 설정값(RPC URL·토큰 주소) 저장
│   ├── ChainContext.jsx     # 연결 상태, 최신 블록 폴링, MTK 컨트랙트 감지
│   ├── erc20.js             # ERC-20 ABI, input/log 디코딩, Transfer 로그 조회
│   ├── useTokenTransfers.js
│   ├── useAsync.js
│   └── format.js
├── components/              # Layout(검색·설정), 링크, 표 등
└── pages/                   # Home, Token, Block, Tx, Address
```
