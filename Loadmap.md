# Blockchain-Challenge

블록체인 도전!

Web2 백엔드 + Cloud DevOps/AA 경험을 바탕으로 **거래소 코어 인프라(입출금/지갑) 직군 이직**을 목표로 하는 학습 저장소.
ERC-20 토큰 하나를 직접 만든 것에서 출발해서, 최종적으로 **엔터프라이즈급 입출금(Wallet/Sweeping) 게이트웨이**를 만든다.

> 원칙: "써봤던 용어"를 "설명할 수 있는 개념"으로, "설명할 수 있는 개념"을 "장애를 막는 코드"로.

---

## 목차

- [최종 목표](#최종-목표)
- [전체 로드맵 한눈에 보기](#전체-로드맵-한눈에-보기)
- [Stage 0. 토큰 만들기 (완료)](#stage-0-토큰-만들기-완료)
- [Stage 1. 트랜잭션 해부 — 기초 체력](#stage-1-트랜잭션-해부--기초-체력)
- [Stage 2. 미니 프로젝트 — 메인 프로젝트의 부품 만들기](#stage-2-미니-프로젝트--메인-프로젝트의-부품-만들기)
- [Stage 3. 메인 프로젝트 — 입출금 게이트웨이 (15일)](#stage-3-메인-프로젝트--입출금-게이트웨이-15일)
- [Stage 4. 마무리 — 포트폴리오화 & 면접 대비](#stage-4-마무리--포트폴리오화--면접-대비)
- [기술 스택 결정](#기술-스택-결정)
- [저장소 구조 (계획)](#저장소-구조-계획)
- [용어 사전 (진행하며 채우기)](#용어-사전-진행하며-채우기)
- [스터디 노트](#스터디-노트)

---

## 최종 목표

거래소 면접관이 매일 고민하는 장애 포인트를 **직접 겪고, 직접 풀어본 경험**을 만든다.

| 장애 포인트 | 실제로 터지는 상황 | 이 프로젝트에서 푸는 방식 |
| --- | --- | --- |
| **멱등성** | 같은 입금이 두 번 반영됨 (스캐너 재시작, 워커 중복 실행) | `(chain_id, tx_hash, log_index)` Unique + Redis 락 + 원장 이중기입 |
| **Finality / Reorg** | 입금 반영 후 블록이 뒤집혀서 입금이 사라짐 | N-Confirmation + 블록 해시 체인 검증 + 롤백 |
| **가스비 스파이크** | 출금/집금 트랜잭션이 멤풀에 몇 시간 정체 | EIP-1559 수수료 추정 + Replacement(속도 올리기) |
| **Nonce 관리** | 동시 출금 시 nonce 충돌 / 한 건 막히면 뒤 전부 막힘 | DB 기반 Nonce Allocator + 막힘 감지 |
| **KMS 서명** | 개인키가 앱 코드/환경변수에 노출 | AWS KMS(secp256k1) 서명 파이프라인 |
| **RPC 장애** | 노드 하나 죽거나 블록이 뒤처져서 입금 감지가 멈춤 | 멀티 RPC Failover + Circuit Breaker + Lag 감지 |

---

## 전체 로드맵 한눈에 보기

```
Stage 0  토큰 만들기 ✅
   │
Stage 1  트랜잭션 해부 (약 5~7일)       ← "이게 뭔지" 설명할 수 있게
   │     전송 · tx 구조 · 이벤트/로그 · 블록/Finality · 테스트넷 · approve 함정
   │
Stage 2  미니 프로젝트 (약 7~10일)       ← 메인 프로젝트의 부품을 하나씩 따로 만들어봄
   │     블록 스캐너 · HD 지갑 · Nonce 실험 · Reorg 재현 · KMS 서명 · 장애 RPC
   │
Stage 3  입출금 게이트웨이 (15일)        ← 부품을 조립해서 하나의 시스템으로
   │     입금 감지 → Finality → 멱등 반영 → 서명 → 집금 → 출금 → 장애 대응 → 관측성
   │
Stage 4  포트폴리오화 & 면접 대비 (약 3일)
```

> **왜 바로 메인 프로젝트로 안 가나?**
> 메인 프로젝트는 "스캐너 + 지갑 + 서명 + nonce + reorg"가 한꺼번에 얽혀 있다. 처음 하는 상태에서 한꺼번에 하면
> 버그가 났을 때 *블록체인을 몰라서인지, 내 코드 문제인지* 구분이 안 된다. Stage 2에서 부품을 따로 만들어두면
> Stage 3은 "조립 + 운영 문제 해결"에만 집중할 수 있다.

각 Step은 다음 형식을 따른다.

- **할 일**: 실제로 손으로 하는 작업
- **완료 기준(DoD)**: 이게 되면 다음으로 넘어감
- **설명할 수 있어야 하는 것**: 면접에서 말로 설명 가능해야 하는 개념 (→ `docs/`에 노트로 정리)

---

## Stage 0. 토큰 만들기 (완료)

- [x] Hardhat + OpenZeppelin으로 고정 발행량 ERC-20(`MyToken`) 작성 → [token/](token/)
- [x] 로컬 테스트 5개 통과
- [x] 로컬 노드 띄우고 MetaMask 연결
- [x] 학습 노트 정리 → [docs/study1.md](docs/study1.md)

---

## Stage 1. 트랜잭션 해부 — 기초 체력

> 목표: 거래소 입출금 시스템이 다루는 **원재료(트랜잭션, 로그, 블록)**를 눈으로 직접 뜯어본다.
> 전부 로컬 Hardhat 노드에서 시작하고, 마지막에 테스트넷으로 간다.

### Step 1-1. 스크립트로 토큰 전송해보기

- **할 일**
  - [ ] `scripts/transfer.js` 작성: Account #0 → Account #1로 MTK 100개 `transfer`
  - [ ] 같은 스크립트에서 ETH(네이티브 코인)도 0.1개 전송
  - [ ] 전송 전/후 잔액을 출력
- **완료 기준**: 두 종류의 전송이 성공하고 잔액 변화가 맞다.
- **설명할 수 있어야 하는 것**
  - ETH 전송과 ERC-20 전송의 근본적 차이 (ETH는 tx의 `value`, 토큰은 컨트랙트 함수 호출의 `data`)
  - 토큰을 "보냈다"는 건 실제로는 컨트랙트 내부 `mapping(address => uint)` 값이 바뀐 것뿐이라는 점
  - `decimals`와 `parseUnits` — 왜 `100`이 아니라 `100 * 10^18`을 넘기는지

### Step 1-2. 트랜잭션 구조 뜯어보기

- **할 일**
  - [ ] Step 1-1의 tx hash로 `getTransaction`, `getTransactionReceipt` 결과 전체를 출력해서 필드 하나하나 확인
  - [ ] `data` 필드를 ABI로 직접 디코딩 (`transfer(address,uint256)` → 함수 셀렉터 `0xa9059cbb` 확인)
  - [ ] **브로드캐스트 없이** 트랜잭션을 서명만 해서 raw tx(hex)를 만든 뒤, 별도로 `eth_sendRawTransaction`으로 전송
- **완료 기준**: "서명"과 "전송"을 분리해서 실행할 수 있다. (← Stage 3 KMS 서명의 핵심 전제)
- **설명할 수 있어야 하는 것**
  - `nonce`, `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, `chainId`, `to`, `value`, `data`, 서명(`v, r, s`)
  - Transaction vs Receipt 차이 (`status`, `gasUsed`, `effectiveGasPrice`, `logs`)
  - 주소는 어디서 오나: 개인키 → 공개키 → keccak256 → 마지막 20바이트
  - 왜 tx를 받은 노드는 보낸 사람을 알 수 있나 (서명에서 공개키 복구 = `ecrecover`)

### Step 1-3. 이벤트와 로그 — 입금 감지의 원재료

- **할 일**
  - [ ] Receipt의 `logs`에서 `Transfer` 이벤트를 찾아 `topics[0]`, `topics[1]`, `topics[2]`, `data`를 직접 해석
  - [ ] `eth_getLogs`로 "특정 블록 범위에서 특정 주소로 들어온 MTK Transfer"만 필터링해서 조회
  - [ ] 컨트랙트에 이벤트 없는 함수를 하나 추가해보고, 로그 기반으로는 감지가 안 된다는 것 확인
- **완료 기준**: 수신 주소로 필터링한 `getLogs` 결과가 실제 전송 내역과 일치한다.
- **설명할 수 있어야 하는 것**
  - `topics`가 indexed 파라미터이고 필터링이 가능한 이유
  - `log_index` — 한 tx 안에 Transfer가 여러 개일 수 있음 (→ 멱등성 키가 `tx_hash`만으로는 부족한 이유)
  - **ETH 입금은 로그가 없다** → 블록의 tx를 순회해야 함. 컨트랙트가 내부에서 ETH를 보내는 경우(internal tx)는 trace가 필요

### Step 1-4. 블록, Confirmation, Finality

- **할 일**
  - [ ] 블록을 연속으로 조회하며 `number`, `hash`, `parentHash`, `timestamp`, `baseFeePerGas` 출력
  - [ ] `parentHash`가 이전 블록의 `hash`와 같은지 검증하는 코드 작성 (← Reorg 감지의 기초)
  - [ ] Sepolia RPC에 `eth_getBlockByNumber("latest" | "safe" | "finalized")` 를 각각 호출해서 블록 번호 차이 관찰
- **완료 기준**: latest와 finalized 사이에 몇 블록 차이가 나는지, 왜 나는지 설명할 수 있다.
- **설명할 수 있어야 하는 것**
  - Confirmation(N블록 쌓임)과 Finality(되돌릴 수 없음 확정)의 차이
  - 이더리움 PoS: 슬롯 12초, 에폭 32슬롯, 보통 2에폭(약 13분) 지나야 finalized
  - Reorg가 왜 생기나 (같은 높이에 두 블록이 경쟁)
  - 체인마다 다른 Finality: BTC(확률적), ETH(PoS finalized), Polygon, L2(Arbitrum은 L1에 배치가 올라가야 진짜 확정)
  - 거래소마다 "입금 확인 N회"가 체인별로 다른 이유

### Step 1-5. 퍼블릭 테스트넷 배포

- **할 일**
  - [ ] Sepolia faucet으로 테스트 ETH 받기
  - [ ] `MyToken`을 Sepolia에 배포
  - [ ] Etherscan에서 컨트랙트 소스 verify (`npx hardhat verify`)
  - [ ] Etherscan에서 내 tx, 로그, 토큰 홀더 탭 확인
  - [ ] RPC 공급자(Alchemy / Infura) 계정 만들고 API 키 2개 이상 확보 (← Stage 2 Failover용)
- **완료 기준**: Etherscan에서 소스가 보이는 내 토큰 컨트랙트가 있다.
- **설명할 수 있어야 하는 것**
  - 퍼블릭 RPC의 rate limit, `eth_getLogs` 블록 범위 제한(공급자마다 다름)

### Step 1-6. approve / transferFrom과 "비표준 토큰"의 함정

- **할 일**
  - [ ] `approve` → `transferFrom` 흐름을 스크립트로 실행
  - [ ] `transfer`가 `bool`을 리턴하지 않는 USDT식 토큰을 직접 만들어서, 일반 인터페이스로 호출했을 때 어떻게 깨지는지 확인
  - [ ] 전송 시 수수료를 떼는 토큰(fee-on-transfer)을 만들어서 "보낸 양 ≠ 받은 양" 확인
- **완료 기준**: 왜 OpenZeppelin `SafeERC20`이 존재하는지 설명할 수 있다.
- **설명할 수 있어야 하는 것**
  - 거래소가 "로그의 amount"가 아니라 "실제 잔고 변화"를 교차검증해야 하는 경우
  - 무한 approve의 위험성

### Stage 1 체크포인트

- [ ] [docs/study2.md](docs/) 작성: Stage 1에서 배운 내용 정리
- [ ] 아래 질문에 막힘 없이 답할 수 있다
  - "ERC-20 입금은 어떻게 감지하나요? ETH 입금은요?"
  - "입금 확인 횟수는 왜 필요하고, 몇으로 정해야 하나요?"
  - "트랜잭션 nonce가 뭔가요?"

---

## Stage 2. 미니 프로젝트 — 메인 프로젝트의 부품 만들기

> 목표: Stage 3에서 쓸 부품을 **각각 독립된 작은 프로그램**으로 만든다.
> 여기서부터는 Stage 3에서 쓸 백엔드 언어로 작성한다 ([기술 스택 결정](#기술-스택-결정) 참고).
> 로컬 체인은 Hardhat 대신 **Foundry의 Anvil**도 함께 써본다 (블록 생성 간격 조절, reorg 재현 등 운영 실험 기능이 풍부함).

### Step 2-1. 개발 환경 세팅

- [ ] Foundry 설치 (`anvil`, `cast`)
- [ ] `cast`로 Stage 1에서 한 것(잔액 조회, 전송, 로그 조회)을 CLI 한 줄로 다시 해보기
- [ ] `docker-compose.yml`에 PostgreSQL, Redis, Anvil 띄우기
- [ ] `anvil --block-time 2`로 2초마다 블록이 생기는 체인 띄우기
- **완료 기준**: `docker compose up` 한 번으로 체인 + DB + Redis가 뜬다.

### Step 2-2. 블록 스캐너 v0 (가장 단순한 버전)

- [ ] 1초마다 최신 블록 번호를 폴링 → 새 블록이 있으면 그 블록의 모든 tx를 출력
- [ ] 감시 대상 주소 목록을 두고, 그 주소로 들어온 **ETH** 전송만 출력
- [ ] 같은 방식으로 `getLogs`로 **ERC-20 Transfer**도 출력
- [ ] 마지막으로 처리한 블록 번호(커서)를 DB에 저장 → 프로그램을 껐다 켜도 이어서 처리
- **완료 기준**: 스캐너를 중간에 죽였다 살려도 입금을 누락하거나 중복 출력하지 않는다.
- **생각해볼 것**: 폴링 vs WebSocket(`eth_subscribe newHeads`) 구독 — 실무에서 구독만 믿으면 안 되는 이유 (연결 끊김 중 누락)

### Step 2-3. HD 지갑 — 유저별 입금 주소 발급기

- [ ] 니모닉(BIP-39) 생성 → BIP-32/44 경로(`m/44'/60'/0'/0/i`)로 주소 100개 파생
- [ ] **xpub(확장 공개키)만으로** 주소를 파생해보기 — 개인키 없이도 입금 주소는 만들 수 있음
- [ ] `user_id → derivation index → address` 매핑을 DB에 저장
- [ ] 같은 index로 다시 파생하면 항상 같은 주소가 나오는지 테스트
- **완료 기준**: 입금 주소 발급 서버는 xpub만 들고 있고, 개인키는 다른 곳에 있다.
- **설명할 수 있어야 하는 것**
  - 거래소가 유저마다 입금 주소를 따로 주는 이유 (입금자 식별)
  - Hardened derivation(`'`)의 의미, xpub 유출 시 위험 범위
  - 대안: 컨트랙트 기반 입금 주소(CREATE2 Forwarder) — Stage 3 Day 11에서 비교

### Step 2-4. Nonce 실험실

- [ ] 같은 계정으로 tx 10개를 **동시에** 보내서 nonce 충돌 재현 (`nonce too low`, `replacement transaction underpriced`)
- [ ] nonce를 일부러 건너뛰어(gap) 보내서 tx가 멤풀에 멈춰 있는 것 확인 → 빈 nonce를 채우면 뒤 tx가 한꺼번에 처리되는 것 확인
- [ ] 아주 낮은 가스비로 tx를 보내 막히게 만든 뒤, **같은 nonce + 더 높은 가스비**로 교체 (Speed up)
- [ ] 같은 nonce로 "나 자신에게 0 ETH 보내기"로 교체 (Cancel)
- **완료 기준**: "왜 출금 tx 하나가 막히면 그 핫월렛의 모든 출금이 멈추는가"를 직접 재현했다.
- **설명할 수 있어야 하는 것**
  - `pending` nonce vs `latest` nonce
  - 교체 조건: 기존보다 수수료를 일정 비율(geth 기본 10%) 이상 올려야 함
  - BTC의 RBF와 이더리움 tx replacement는 같은 아이디어지만 메커니즘이 다름 (UTXO vs Account 모델)

### Step 2-5. Reorg 재현

- [ ] Anvil/Hardhat의 `evm_snapshot` → 블록 몇 개 생성(입금 tx 포함) → `evm_revert` → 다른 블록 생성으로 "블록이 뒤집히는 상황" 만들기
  - (Anvil의 `anvil_reorg` RPC가 있으면 그것도 사용)
- [ ] Step 2-2 스캐너가 이 상황에서 **이미 출력한 입금을 잘못 믿고 있는 것**을 확인 (버그 재현)
- [ ] 스캐너에 블록 해시 저장 + `parentHash` 검증 추가 → 불일치 시 공통 조상까지 되감기
- **완료 기준**: reorg가 발생하면 스캐너가 이를 감지하고, 뒤집힌 블록의 입금을 "무효"로 표시한다.

### Step 2-6. 외부 서명 — KMS로 이더리움 tx 서명하기

> 이 단계가 Stage 2에서 가장 어렵다. 막히면 하루 더 써도 괜찮다.

- [ ] LocalStack(로컬 AWS 에뮬레이터) 또는 실제 AWS에서 KMS 키 생성 (Key spec: `ECC_SECG_P256K1`, 용도: Sign/Verify)
- [ ] KMS 공개키(DER) → 이더리움 주소 변환
- [ ] 트랜잭션 해시(digest)를 KMS `Sign` API로 서명 (`MessageType: DIGEST`)
- [ ] KMS가 준 DER 서명 → `r`, `s` 추출 → **`s`가 크면 `n - s`로 정규화(low-s, EIP-2)** → `v`는 복구 시도로 결정
- [ ] 완성된 raw tx를 Anvil에 보내 실제로 성공하는지 확인
- **완료 기준**: 개인키가 코드/환경변수/디스크 어디에도 없는 상태로 tx를 보냈다.
- **설명할 수 있어야 하는 것**
  - 왜 KMS는 이더리움 서명을 바로 주지 않고 DER을 주나
  - KMS 권한(IAM Policy)으로 "누가 서명할 수 있나"를 통제하는 방법
  - 핫월렛 / 웜월렛 / 콜드월렛 구분, 그리고 각각 KMS·HSM·오프라인 서명 중 무엇이 맞는지

### Step 2-7. 불안정한 RPC 다루기

- [ ] RPC 앞에 장애를 주입하는 프록시 만들기 (랜덤 지연, 랜덤 500, 일부러 몇 블록 뒤처진 응답) — 간단한 HTTP 프록시면 충분
- [ ] RPC 클라이언트에 타임아웃 + 재시도(지수 백오프) 적용
- [ ] RPC 2개 이상 등록 → 하나가 실패하면 다음으로 넘어가기
- [ ] 각 RPC의 최신 블록 번호를 비교해서 **뒤처진 노드를 감지**하고 배제
- **완료 기준**: 프록시로 RPC 하나를 망가뜨려도 스캐너가 멈추지 않는다.

### Stage 2 체크포인트

- [ ] [docs/study3.md](docs/) 작성: 부품별 설계 메모와 겪은 에러 정리
- [ ] 아래 질문에 답할 수 있다
  - "입금 주소는 어떻게 발급하나요? 서버에 개인키가 있어야 하나요?"
  - "Reorg가 나면 어떻게 처리하나요?"
  - "출금 tx가 멤풀에 몇 시간째 안 들어가요. 어떻게 하나요?"
  - "KMS로 이더리움 서명하면 어떤 문제가 있나요?"

---

## Stage 3. 메인 프로젝트 — 입출금 게이트웨이 (15일)

### 아키텍처 개요

```
                ┌───────────────┐
  유저/관리자 ─▶│   API 서버    │── 입금 주소 발급 / 출금 요청 / 잔액 조회
                └──────┬────────┘
                       │
         ┌─────────────┼───────────────────────────────┐
         ▼             ▼                               ▼
  ┌─────────────┐ ┌──────────────┐            ┌─────────────────┐
  │ Block       │ │ Confirmation │            │ Sweep / Withdraw│
  │ Scanner     │ │ Worker       │            │ Engine          │
  │ (입금 감지) │ │ (Finality,   │            │ (tx 생성)       │
  └─────┬───────┘ │  Reorg)      │            └───────┬─────────┘
        │         └──────┬───────┘                    │
        ▼                ▼                            ▼
  ┌──────────────────────────────┐          ┌──────────────────┐
  │ PostgreSQL                   │          │ Nonce Manager    │
  │  deposits / ledger / blocks  │◀────────▶│ (DB + Redis Lock)│
  │  withdrawals / txs / nonces  │          └───────┬──────────┘
  └──────────────────────────────┘                  ▼
                                            ┌──────────────────┐
                                            │ Signer (KMS)     │
                                            └───────┬──────────┘
                                                    ▼
                                  ┌──────────────────────────────────┐
                                  │ RPC Gateway (Failover, CB, Lag)  │
                                  └───────────────┬──────────────────┘
                                                  ▼
                                     Anvil (로컬) / Sepolia (리허설)
```

### 핵심 상태 머신

```
입금:  DETECTED ─▶ CONFIRMING ─▶ CONFIRMED ─▶ CREDITED ─▶ SWEPT
                       │
                       └──▶ ORPHANED (reorg로 사라짐)

출금:  REQUESTED ─▶ APPROVED ─▶ SIGNED ─▶ BROADCAST ─▶ MINED ─▶ CONFIRMED
                                               │          │
                                               │          └──▶ FAILED (status=0, revert)
                                               └──▶ REPLACED (더 높은 가스비로 교체됨)
```

---

### Day 1. 설계

- [ ] ERD 작성: `users`, `deposit_addresses`, `blocks`, `deposits`, `ledger_entries`, `withdrawals`, `onchain_txs`, `hot_wallet_nonces`, `scan_cursors`
- [ ] 위 상태 머신을 문서로 확정 (`docs/design/state-machine.md`) — 각 전이의 **트리거**와 **허용되지 않는 전이** 명시
- [ ] 체인 설정 구조 정의: `chain_id`, `required_confirmations`, `rpc_urls[]`, `tokens[]` (체인 추가가 설정만으로 되도록)
- [ ] 저장소 구조 + `docker-compose.yml`(Postgres, Redis, Anvil, LocalStack) 확정
- **DoD**: 설계 문서만 보고 남이 구현을 시작할 수 있다.
- **ADR 작성**: "입금 주소 방식: HD EOA vs CREATE2 Forwarder" — 일단 HD EOA로 시작하고 Day 11에 재평가

### Day 2. 입금 주소 발급 API

- [ ] Step 2-3 코드를 서비스로 이식: `POST /users/{id}/deposit-address`
- [ ] 동시 요청 시 같은 유저에게 주소가 두 개 발급되지 않도록 처리 (DB Unique + 재시도)
- [ ] derivation index를 원자적으로 증가 (시퀀스 사용)
- **DoD**: 동시에 100번 호출해도 유저당 주소 1개, index 중복 없음 (테스트로 증명)

### Day 3. 블록 스캐너 v1 — 네이티브 코인 입금

- [ ] 체인별 `scan_cursor`부터 블록 단위로 순회
- [ ] 블록의 tx 중 `to`가 입금 주소인 것 → `deposits`에 `DETECTED`로 저장
- [ ] 블록 메타데이터(`number`, `hash`, `parentHash`)를 `blocks` 테이블에 저장
- [ ] 커서 갱신과 입금 저장을 **하나의 DB 트랜잭션**으로 묶기
- **DoD**: 스캐너를 임의 시점에 `kill -9` 해도 누락/중복 없음

### Day 4. 블록 스캐너 v2 — ERC-20 입금

- [ ] 지원 토큰 목록에 대해 `eth_getLogs`로 Transfer 이벤트 조회
- [ ] 블록 범위를 청크(예: 500블록)로 나눠 조회 + RPC가 "범위 너무 큼" 에러를 주면 범위를 자동으로 반으로 줄이기
- [ ] 따라잡기(catch-up) 모드와 실시간 모드 분리 (밀린 블록이 많을 때 vs 최신 근처일 때)
- [ ] fee-on-transfer 같은 이상한 토큰은 지원하지 않는 것으로 명시 (화이트리스트 방식)
- **DoD**: 스캐너를 1시간 꺼뒀다 켜도 그 사이 입금을 전부 따라잡는다

### Day 5. Confirmation 워커

- [ ] `CONFIRMING` 상태 입금들에 대해 `현재 블록 - 입금 블록 + 1 >= N`이면 `CONFIRMED`로 전이
- [ ] 체인별 N 설정 (로컬 3, Sepolia 12 등) + `finalized` 태그 기반 모드도 옵션으로 지원
- [ ] 상태 전이는 **조건부 UPDATE**로 (`UPDATE ... SET status='CONFIRMED' WHERE id=? AND status='CONFIRMING'`) → 영향 받은 행 0이면 무시
- **DoD**: 워커를 2개 동시에 띄워도 같은 입금이 두 번 전이되지 않는다

### Day 6. Reorg 처리

- [ ] 새 블록의 `parentHash`가 DB에 저장된 이전 블록 `hash`와 다르면 reorg로 판단
- [ ] 공통 조상 블록을 찾을 때까지 되감고, 그 이후 블록의 `DETECTED`/`CONFIRMING` 입금을 `ORPHANED`로
- [ ] 같은 tx가 새 체인에 다시 포함되면 새로 감지 (멱등 키로 처리 — Day 7과 연결)
- [ ] **만약 이미 CREDITED된 입금이 reorg되면?** → 자동 처리하지 않고 알림 + 수동 처리 대기열 (설계 결정을 ADR로 남기기)
- [ ] Step 2-5의 reorg 재현 스크립트로 통합 테스트
- **DoD**: reorg 깊이 1, 3, N+1(확정 이후 뒤집힘) 시나리오 각각에 대한 테스트가 통과

### Day 7. 멱등성 & 원장(Ledger)

- [ ] 입금 멱등 키: `UNIQUE(chain_id, tx_hash, log_index)` (네이티브 입금은 `log_index = -1` 등 규칙 정의)
- [ ] `CONFIRMED → CREDITED` 시 원장에 **이중기입**(유저 잔액 +, 거래소 부채 +)을 같은 트랜잭션에서 기록
- [ ] Redis 분산 락은 "중복 작업 줄이기" 용도, **최종 방어선은 DB 제약**이라는 점을 코드 구조로 보여주기
- [ ] 출금 API에 `Idempotency-Key` 헤더 지원 (같은 키로 재요청 시 같은 결과 반환)
- **DoD**: 같은 입금 이벤트를 강제로 10번 주입해도 원장에는 1번만 기록됨 (테스트)
- **설명할 수 있어야 하는 것**: Redis 락만으로는 왜 부족한가 (락 만료, 네트워크 분단, GC Pause)

### Day 8. Signer 서비스 (KMS)

- [ ] Step 2-6 코드를 `Signer` 인터페이스로 추상화: `sign(unsignedTx) → signedRawTx`
  - 구현체: `KmsSigner`(LocalStack/AWS), `LocalKeySigner`(테스트 전용)
- [ ] 핫월렛 주소 = KMS 키에서 유도한 주소
- [ ] Signer는 **서명만** 한다. nonce 결정/브로드캐스트는 하지 않는다 (책임 분리)
- [ ] 서명 요청 감사 로그 (누가, 언제, 어떤 tx를)
- **DoD**: 앱 설정 파일/환경변수 어디에도 개인키가 없다

### Day 9. Nonce Manager

- [ ] 핫월렛별 nonce를 DB에서 관리: `SELECT ... FOR UPDATE`로 다음 nonce 할당
- [ ] 서버 시작 시 체인의 `pending` nonce와 DB 값을 비교해서 동기화
- [ ] "할당했지만 서명/전송 실패한 nonce" 처리 → 그 nonce가 비면 뒤가 전부 막힘 → 반드시 채우거나(재전송/Cancel tx) 회수
- [ ] Nonce gap 감지 모니터
- **DoD**: 출금 50건을 동시에 넣어도 nonce 중복/누락 없이 전부 처리됨

### Day 10. Sweeping v1 — 집금

- [ ] 주기적으로 입금 주소 잔고 확인 → 임계값 이상이면 집금 대상
- [ ] **ETH 집금**: `잔고 - (gasLimit × maxFeePerGas)` 만큼 핫월렛으로 전송
- [ ] **ERC-20 집금의 고질적 문제**: 입금 주소에 가스비(ETH)가 없음 →
  1. 핫월렛이 입금 주소로 가스비 ETH 충전(Gas Top-up)
  2. 충전 tx 확정 대기
  3. 입금 주소가 토큰을 핫월렛으로 전송
  4. 남은 dust ETH 처리 정책 결정
- [ ] 집금 작업 자체도 상태 머신으로 관리 (중간에 죽어도 재개 가능)
- **DoD**: 입금 주소 10개에 쌓인 ETH/MTK가 핫월렛으로 모인다

### Day 11. 가스비 최적화 & 대안 설계 비교

- [ ] EIP-1559 수수료 추정기: `eth_feeHistory`로 최근 base fee/priority fee 분위수 계산
- [ ] 집금 조건에 "가스비가 너무 비싸면 미루기" 추가 (집금 금액 대비 가스비 비율 임계값)
- [ ] **(선택) CREATE2 Forwarder 방식 구현**: 입금 주소를 컨트랙트로 만들고, 컨트랙트가 한 번의 tx로 여러 주소를 일괄 집금(flush)
  - 장점: Gas Top-up 불필요, 배치 가능 / 단점: 컨트랙트 배포 비용, 컨트랙트 버그 리스크, 로그 없는 ETH 입금 감지 어려움
- [ ] Day 1 ADR 업데이트 — 두 방식의 가스 비용을 실제 숫자로 비교
- **DoD**: "가스비가 갑자기 10배 뛰면 집금은 어떻게 되나요?"에 코드로 답할 수 있다

### Day 12. 출금 & 막힌 트랜잭션 교체

- [ ] 출금 흐름: `REQUESTED → APPROVED`(한도/화이트리스트 검사) `→ SIGNED → BROADCAST`
- [ ] 브로드캐스트한 tx가 X분 이상 미포함이면 **같은 nonce + 수수료 상향(최소 10%↑)**으로 재서명·재전송
- [ ] 교체 시 원래 tx와 교체 tx **둘 다 추적** — 어느 쪽이 채굴될지 모름. 하나가 채굴되면 나머지는 `REPLACED`
- [ ] 수수료 상한(cap) 설정 — 무한히 올리지 않기
- [ ] Revert된 출금(`status=0`) 처리 → 가스비는 나갔고 자산은 안 나감 → 원장 보정
- **DoD**: 일부러 낮은 가스비로 출금 → 자동 교체 → 최종 1건만 성공 + 원장 정확

### Day 13. RPC Gateway — Failover & Circuit Breaker

- [ ] Step 2-7 코드를 공용 RPC 클라이언트로 이식
- [ ] Circuit Breaker (연속 실패 시 OPEN → 일정 시간 후 HALF_OPEN → 성공 시 CLOSED)
- [ ] 노드 간 블록 높이 비교로 lag 노드 배제
- [ ] **읽기와 쓰기 분리**: 브로드캐스트는 여러 노드에 동시에 보내도 되지만(같은 tx라 안전), 조회는 일관성 있는 노드 하나로
- **DoD**: 장애 프록시로 RPC를 하나씩 죽여도 입금 감지·출금이 계속됨

### Day 14. 관측성 & 카오스 테스트

- [ ] 메트릭(Prometheus): 스캔 지연 블록 수, `CONFIRMING` 대기 건수, 핫월렛 잔고, 미포함 tx 수/최대 대기시간, RPC별 에러율
- [ ] Grafana 대시보드 1장
- [ ] 알림 규칙: 스캔 지연 > N블록, 핫월렛 잔고 < 임계값, nonce gap 발생, reorg 감지
- [ ] 카오스 시나리오 스크립트화 & 결과 기록
  - [ ] RPC 전부 다운 후 복구
  - [ ] reorg 주입
  - [ ] 가스비 스파이크 (Anvil `anvil_setNextBlockBaseFeePerGas`)
  - [ ] 워커 프로세스 kill -9
  - [ ] DB 커넥션 끊김
- **DoD**: 각 시나리오에서 "무슨 일이 일어났고, 시스템이 어떻게 반응했는지"가 문서에 있다

### Day 15. Sepolia 실전 리허설 & 문서화

- [ ] 로컬 설정 그대로 Sepolia로 체인만 바꿔서 실행 (설정만으로 체인 전환되는지 검증)
- [ ] 실제 입금 → 확인 → 반영 → 집금 → 출금 전 과정을 Etherscan 링크와 함께 기록
- [ ] 장애 대응 런북(Runbook) 작성: "출금이 막혔을 때", "reorg 알림이 왔을 때", "핫월렛 잔고 부족"
- [ ] 아키텍처 다이어그램 최종본

---

## Stage 4. 마무리 — 포트폴리오화 & 면접 대비

- [ ] 메인 프로젝트 README: 문제 → 설계 결정(ADR) → 장애 시나리오 → 결과 수치
- [ ] "가장 어려웠던 버그" 3개를 STAR 형식으로 정리
- [ ] 데모 영상 또는 GIF (입금 → 대시보드 반영 → 집금)
- [ ] 면접 질문 리스트 셀프 답변 작성 (`docs/interview.md`)
  - [ ] 입금 감지 방식과 누락/중복 방지
  - [ ] Confirmation 수는 어떻게 정하나, 체인별로 왜 다른가
  - [ ] 이미 반영한 입금이 reorg되면?
  - [ ] Nonce 관리 전략과 막힘 해결
  - [ ] 개인키 보관 전략 (Hot/Warm/Cold, KMS/HSM/MPC)
  - [ ] 집금 시 가스비 문제와 해결책
  - [ ] RPC 노드를 직접 운영해야 하나, 외부 공급자를 써야 하나
  - [ ] UTXO 체인(BTC)이라면 이 설계에서 무엇이 바뀌나
- [ ] (확장 아이디어) BTC 테스트넷 입금 감지 추가 — UTXO 모델 체험
- [ ] (확장 아이디어) MPC/멀티시그(Gnosis Safe) 기반 콜드월렛 출금 승인 플로우

---

## 기술 스택 결정

| 영역 | 선택 | 이유 |
| --- | --- | --- |
| 컨트랙트 | Solidity + Hardhat (기존) + Foundry(Anvil/cast) | 기존 토큰 재사용, Anvil은 운영 실험 RPC가 풍부 |
| 백엔드 | **Kotlin/Java + Spring Boot + web3j** (권장) 또는 TypeScript + viem | 기존 Web2 강점 활용. 국내 거래소 백엔드 스택과도 가까움. TS를 고르면 예제 자료가 더 많음 |
| DB | PostgreSQL | 조건부 UPDATE, `FOR UPDATE`, Unique 제약 — 멱등성의 최종 방어선 |
| 락/캐시 | Redis | 분산 락(보조 수단), rate limit |
| 서명 | AWS KMS (`ECC_SECG_P256K1`) / LocalStack | 개인키 비노출 |
| 장애 대응 | Resilience4j(JVM) 또는 직접 구현 | Circuit Breaker, Retry |
| 관측성 | Prometheus + Grafana | 스캔 지연, 핫월렛 잔고 등 |
| 인프라 | Docker Compose → (선택) Terraform으로 AWS KMS/IAM | DevOps 강점 어필 |

> Stage 2 시작 전에 백엔드 언어를 확정하고 이 표를 업데이트할 것.

---

## 저장소 구조 (계획)

```
Blockchain-Challenge/
├── README.md                 # 이 로드맵
├── docs/
│   ├── study1.md             # Stage 0 노트 ✅
│   ├── study2.md             # Stage 1 노트
│   ├── study3.md             # Stage 2 노트
│   ├── design/               # ERD, 상태 머신, 아키텍처
│   ├── adr/                  # 설계 결정 기록
│   ├── runbook/              # 장애 대응 런북
│   └── interview.md
├── token/                    # Stage 0~1: 토큰 & 트랜잭션 실습 스크립트 ✅
├── playground/               # Stage 2: 미니 프로젝트들 (scanner-v0, hd-wallet, nonce-lab, reorg-lab, kms-signer, rpc-chaos)
└── gateway/                  # Stage 3: 메인 프로젝트
    ├── docker-compose.yml
    └── ...
```

---

## 용어 사전 (진행하며 채우기)

모르는 용어가 나오면 여기에 한 줄로 추가하고, 길어지면 `docs/`로 옮긴다.

| 용어 | 한 줄 설명 | 처음 등장 |
| --- | --- | --- |
| EOA | 개인키로 제어하는 일반 지갑 주소 | Stage 0 |
| Nonce | 계정이 보낸 tx의 순번. 같은 nonce는 하나만 채굴됨 | Step 1-2 |
| Log / Event | 컨트랙트가 남기는 기록. 입금 감지의 원재료 | Step 1-3 |
| Confirmation | tx가 포함된 블록 위로 쌓인 블록 수 | Step 1-4 |
| Finality | 블록이 되돌려질 수 없음이 확정된 상태 | Step 1-4 |
| Reorg | 체인의 최근 블록 일부가 다른 블록으로 교체되는 현상 | Step 1-4 |
| xpub | 확장 공개키. 개인키 없이 하위 주소를 파생 가능 | Step 2-3 |
| Sweeping | 유저 입금 주소에 흩어진 자산을 핫/콜드월렛으로 모으는 작업 | Day 10 |
| | | |

---

## 스터디 노트

- [study1.md](docs/study1.md) — 코인 vs 토큰, ERC-20, EVM 체인, 테스트넷, Hardhat/OpenZeppelin, 로컬 실습 Q&A
