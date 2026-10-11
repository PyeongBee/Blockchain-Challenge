# 블록체인 토큰 만들기 스터디 노트 #2 (Stage 1 — Step 1-1)

Step 1-1(스크립트로 토큰 전송해보기)을 진행하면서 질문하고 답변받은 내용을 정리한 노트.
스터디1에서 다룬 내용(코인 vs 토큰, 로컬/테스트넷/메인넷 차이, Hardhat/OpenZeppelin의 역할, 체인ID 등)은 중복 생략.

---

## 1. Step 1-1 — 뭘 만들었나

- [scripts/transfer.js](../token/scripts/transfer.js): Account #0 → Account #1로 **MTK(ERC-20) 100개**와 **ETH 0.1개**를 각각 전송하고, 전송 전/후 잔액을 출력.
- 처음엔 스크립트 안에서 매번 새로 배포하는 구조였다가, **"배포(deploy.js)"와 "전송(transfer.js)"을 분리**하는 구조로 리팩터링함 (3번 참고).

```bash
npm run node                                    # 터미널 1: 로컬 노드
npm run deploy:localhost                        # 터미널 2: 배포 → 컨트랙트 주소 출력
# 그 주소를 .env의 TOKEN_ADDRESS= 에 넣거나 $env:TOKEN_ADDRESS="0x..." 로 설정
npm run transfer:localhost                      # 터미널 2: 그 주소로 전송만
```

---

## 2. `ethers`는 뭐고, 왜 코드에 "연결" 과정이 안 보이나

`const { ethers, network } = require("hardhat");`의 `ethers`는 순정 ethers.js가 아니라, **Hardhat Runtime Environment(HRE)에 묶여 있는 버전**이다.

- `npx hardhat run script.js --network localhost`를 실행하는 순간, Hardhat이 `--network` 플래그를 읽어서 그 네트워크의 provider를 먼저 만들어두고, 그 다음에야 스크립트를 실행함 → 스크립트 입장에서는 `require("hardhat")`로 꺼내는 순간 이미 연결이 끝난 `ethers`를 받는 것.
- `getSigners()`는 **현재 네트워크의 `accounts` 설정**을 본다:
  - `hardhat`(인메모리) / `localhost`: `accounts` 생략 시 Hardhat 기본 니모닉에서 20개 자동 생성 (스터디1에서 다룬 그 계정들).
  - `sepolia`/`amoy`처럼 `accounts: [PRIVATE_KEY]`를 명시한 네트워크: `.env`의 개인키 **딱 하나**로만 `Wallet`을 만듦 → `getSigners()[1]`은 `undefined`.
  - **커스텀 네트워크에서 `accounts`를 생략하면** 기본값 `"remote"`로 빠져서 "RPC 노드가 알아서 서명해줄 것"을 기대함 → Infura/Alchemy 같은 공개 RPC는 개인키가 없어서 `eth_accounts`가 빈 배열을 반환 → `deployer`가 `undefined`가 되어 터짐. **진짜 네트워크는 `accounts`를 생략하면 안 됨.**
- 로컬(hardhat/localhost) vs 진짜 네트워크의 서명 책임 차이:

  | | hardhat / localhost | sepolia / amoy |
  | --- | --- | --- |
  | 개인키 위치 | 노드(서버)가 테스트키를 들고 있음 | ethers 프로세스(내 PC)가 `.env` 키로 `Wallet` 생성 |
  | 서명 주체 | 노드가 `eth_sendTransaction` 받고 직접 서명+전송 | ethers가 로컬에서 먼저 서명 → `eth_sendRawTransaction`으로 서명된 결과만 전송 |

  → Stage 3에서 "개인키를 코드/환경변수에서 빼고 KMS로 옮기자"는 목표와 바로 연결되는 지점. `.env`에 평문 PRIVATE_KEY를 두는 지금 방식 자체가 나중에 없애야 할 패턴.

---

## 3. 컨트랙트는 "이름"이 아니라 "주소"로 식별된다

### `getContractFactory("MyToken")`은 네트워크가 아니라 로컬 `artifacts/`를 본다

`npm run compile`을 돌리면 `contracts/*.sol`이 컴파일되어 `artifacts/contracts/<파일명>.sol/<컨트랙트명>.json`(ABI + bytecode)으로 로컬에 저장됨. `getContractFactory("MyToken")`은 **이 로컬 파일을 이름으로 찾는 것**이고, 네트워크는 전혀 관여하지 않는다. `.deploy()`를 호출하는 순간에야 비로소 "이 bytecode를 어느 네트워크에 쏠지"가 의미를 가짐.

→ 그래서 "체인에 이미 배포된 남의 컨트랙트"는 이름으로 못 찾는다. 체인에는 이름이란 개념이 없고 **주소 + bytecode + storage**뿐 — Etherscan에 보이는 이름은 verify할 때 소스를 올려서 Etherscan이 붙여준 라벨일 뿐.

### 같은 이름으로 두 번 배포 = 완전히 독립된 별개의 컨트랙트 2개

실제로 `MyToken`을 같은 계정으로 두 번 배포해보면 주소가 매번 다르게 나온다 (`0x9fE4...`, `0xCf7E...` 등). 이유는 컨트랙트 주소가

```
address = keccak256(rlp(배포자_주소, nonce))의 마지막 20바이트
```

로 결정되는데, tx를 보낼 때마다 `nonce`가 1씩 증가해서 매번 새 주소가 나오기 때문. 즉 "같은 이름으로 재배포"는 기존 걸 덮어쓰는 게 아니라 **storage(잔액 등)가 완전히 분리된 신규 컨트랙트를 하나 더 만드는 것**.

### 그래서 `deploy.js`와 `transfer.js`를 분리함

처음엔 `transfer.js` 안에서 매번 새로 `MyToken`을 배포하고 그 안에서만 전송 테스트를 했는데, 이건 실제 운영 흐름(이미 배포된 컨트랙트 주소에 붙어서 작업하는 지갑/거래소 서버)과 안 맞는 연습이었음. `ethers.getContractAt("MyToken", 주소, signer)`로 **새로 배포하지 않고 기존 주소에 연결만** 하도록 고침:

```js
// 배포는 deploy.js가 한 번만. transfer.js는 그 결과 주소만 받아서 쓴다.
const token = await ethers.getContractAt("MyToken", process.env.TOKEN_ADDRESS, account0);
```

---

## 4. `deploy()` → `waitForDeployment()`: "보내기"와 "확정 기다리기"는 분리된 단계

```js
const token = await MyToken.deploy(INITIAL_SUPPLY);  // ① tx를 만들어 서명하고 전송(브로드캐스트)
await token.waitForDeployment();                     // ② 그 tx가 블록에 실릴 때까지 대기 + 코드 존재 확인
```

- ①이 끝나는 시점엔 아직 블록에 포함됐는지 모름 — tx hash만 받은 상태. 다만 컨트랙트 주소는 "배포자 주소 + nonce"로 미리 결정되므로 이 시점에 이미 알 수 있음.
- ②는 영수증(Receipt)이 나올 때까지 polling하고, `eth_getCode`로 그 주소에 실제 코드가 있는지 확인한 뒤에 resolve.
- 로컬(hardhat/localhost)은 **auto-mining**이라 tx 보내는 즉시 블록이 생겨서 둘이 거의 동시에 끝나는 것처럼 보이지만, Sepolia 같은 진짜 네트워크에서는 ①은 즉시 끝나고 ②는 실제 블록 타임만큼 기다려야 함.
- 이 간극이 Step 1-2의 "서명과 전송을 분리해서 실행"(서명된 raw tx만 뽑아뒀다가 나중에 따로 전송)과 직결됨 — Stage 3 KMS 서명의 핵심 전제.

---

## 5. ETH 전송과 토큰 전송은 결국 같은 파이프라인, `data` 필드만 다르다

```js
await token.transfer(account1.address, tokenAmount);                              // ①
await account0.sendTransaction({ to: account1.address, value: ethAmount });        // ②
```

둘 다 최종적으로 `sendTransaction`(`eth_sendTransaction`/`eth_sendRawTransaction`)을 탄다. 차이는 `data` 필드 유무:

- ②: `to`=사람 주소(EOA, 코드 없음), `data` 없음 → EVM이 컨트랙트를 실행하지 않고, **프로토콜 자체의 상태 전이 규칙**으로 balance만 직접 증감.
- ①: `to`=컨트랙트 주소, `data`=`transfer(address,uint256)`의 함수 셀렉터(`0xa9059cbb`) + ABI 인코딩된 인자. EVM이 `to` 주소의 바이트코드(OpenZeppelin `ERC20.transfer()`)를 실제로 실행.

`token.transfer(...)`는 사실 아래와 완전히 동일한 걸 감싸주는 편의 래퍼일 뿐:

```js
const data = token.interface.encodeFunctionData("transfer", [account1.address, tokenAmount]);
await account0.sendTransaction({ to: tokenAddress, data, value: 0n });
```

→ "네트워크 자체 송금 vs 컨트랙트 함수 호출"의 구분은 맞지만, 밑바닥에서는 둘 다 같은 tx 파이프라인(서명 → 브로드캐스트 → 블록 포함)을 탄다는 게 핵심.

---

## 6. `data`가 많을수록 가스비가 드나? — 직접 비용 + 간접 비용

로컬 네트워크에서 `estimateGas`로 직접 측정한 결과:

| 케이스 | 예상 gas |
| --- | --- |
| data 없음 (순수 ETH 전송) | 21001 |
| data 32바이트, 전부 `0x00` | 21320 |
| data 32바이트, 전부 `0xff` | 22280 |
| data 1000바이트, 전부 `0xff` | 61000 |

- 모든 tx는 **21000 고정 기본 비용**이 있고, `data`가 길어질수록 바이트당 추가 비용이 붙는다.
- **값이 0인 바이트가 0이 아닌 바이트보다 더 싸다** (이더리움이 "빈 데이터"와 "실제 값"을 구분해서 과금).
- 다만 실제 컨트랙트 호출(`token.transfer()`, 51632 gas)은 calldata가 겨우 68바이트인데도 ETH 전송(21000)보다 3만 gas나 더 든다 — 이 차이의 대부분은 **data 크기가 아니라 그 data로 실행되는 코드**(기존 잔액 읽기/새 잔액 쓰기(SSTORE)/`Transfer` 이벤트 로그)에서 나옴. 특히 storage를 "0에서 처음 채우는" 연산이 제일 비쌈.
- 결론: data만 많고 로직을 안 타면 바이트 비용이 지배적이지만, **컨트랙트 함수 호출에서는 data 크기보다 "몇 번의 storage 읽기/쓰기를 하는지"가 가스비를 훨씬 더 크게 좌우**함. Stage 3 "가스비 최적화"가 단순히 데이터를 줄이는 게 아니라 로직/storage 접근을 줄이는 방향인 이유.

---

## 7. 실수했던 것 — `bigint`를 문자열로 바꾼 뒤에 계산하면 정밀도가 깨진다

가스비 = 배포 전 ETH − 배포 후 ETH를 계산하면서 처음엔 이렇게 짰다가 오차가 났던 사례:

```js
const beforeBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address)); // 문자열!
const afterBalance = ethers.formatEther(await ethers.provider.getBalance(deployer.address));   // 문자열!
const gasfee = beforeBalance - afterBalance;   // 문자열 - 문자열 → JS가 Number(부동소수점)로 변환
```

`getBalance()`는 wei 단위의 **`bigint`**(정밀도 손실 없는 정수)를 주는데, `formatEther()`를 씌우면 사람이 보기 좋은 **문자열**로 바뀜 — 그 이후로 계산용이 아니라 "표시용"임. 문자열끼리 `-`를 하면 JS가 `Number`(유효숫자 15~17자리 한계)로 변환해서 빼기 때문에, ETH 18자리 소수점 값에서는 끝부분이 뭉개짐.

**올바른 패턴**: wei(`bigint`)로 끝까지 계산하고, **보여줄 때만** `formatEther`를 씌운다.

```js
const beforeBalance = await ethers.provider.getBalance(deployer.address); // bigint
const afterBalance = await ethers.provider.getBalance(deployer.address);  // bigint
const gasFeeWei = beforeBalance - afterBalance;        // bigint - bigint, 정밀도 손실 없음
console.log(ethers.formatEther(gasFeeWei));             // 표시 직전에만 변환
```

---

## 8. 환경변수(`TOKEN_ADDRESS` 등) 입력 방법 — PowerShell 셸이라 bash 문법이 안 먹힘

bash의 `VAR=값 명령어` 한 줄 문법은 PowerShell에 없음. 두 가지 대안:

1. **세션 임시 변수** (터미널 닫으면 사라짐):
   ```powershell
   $env:TOKEN_ADDRESS = "0x..."
   npm run transfer:localhost
   ```
2. **`.env` 파일에 저장** (dotenv가 `hardhat.config.js`에서 이미 `require("dotenv").config()`로 로드해두기 때문에, 스크립트가 셸 설정 없이 `process.env.TOKEN_ADDRESS`를 바로 읽음):
   ```
   # .env
   TOKEN_ADDRESS=0x...
   ```
   로컬 재배포할 때마다 주소가 바뀌므로 그때그때 갱신 필요. (`.env`는 `.gitignore`로 커밋 안 됨 — `.env.example`에 템플릿만 문서화해둠.)

---

## 9. "deployer"와 "owner"는 다른 레벨의 개념

- **deployer**: 컨트랙트 생성 tx에 서명한 사람. EVM이 아는 사실(`msg.sender`)이라 코드와 무관하게 항상 존재하고, 블록 익스플로러에 영구히 "Creator"로 남는 바꿀 수 없는 역사적 사실.
- **owner**: EVM이 아는 개념이 아니라, **컨트랙트 코드가 직접 정의했을 때만** 존재하는 애플리케이션 레벨 권한. 지금 `MyToken`은 `ERC20`만 상속하고 `Ownable`은 안 써서 **"owner"라는 역할 자체가 없음** — `_mint(msg.sender, ...)`은 그냥 "배포자 잔액에 토큰을 찍어준다"일 뿐, 특별 권한을 주는 게 아님.
- 실제 설치된 OpenZeppelin v5의 `Ownable`은 생성자가 `initialOwner`를 **명시적으로** 받도록 강제함 (`msg.sender` 자동 기본값 X) — 배포에 쓰는 키(임시, 버려도 됨)와 관리자 권한을 쥔 키(콜드월렛/멀티시그)를 분리하라는 설계 의도. Stage 2-6(KMS 서명), Stage 3 Day 8(Signer 서비스)과 이어지는 보안 패턴.

---

## 10. 로컬 바이너리는 왜 그냥 `hardhat`이라고 치면 안 되나

`hardhat`은 전역이 아니라 `token/node_modules/.bin/hardhat`에만 설치되어 있음 (`devDependencies`). 일반 셸의 `PATH`는 이 폴더를 안 보므로 그냥 타이핑하면 "command not found".

| 방법 | 동작 |
| --- | --- |
| `hardhat ...` (그냥 타이핑) | 실패 — 시스템 PATH에 없음 |
| `npx hardhat ...` | npx가 현재 폴더 기준 `node_modules/.bin`을 먼저 찾아봄 |
| `npm run <script>` | npm이 실행 중에만 `node_modules/.bin`을 PATH 맨 앞에 임시로 추가 |

`package.json`의 `scripts`에 적힌 `hardhat compile` 같은 문구는 전역 명령어가 아니라, `npm run` 실행 중에만 유효한 임시 PATH에 의존하는 것.

---

## 다음에 해볼 것 (Step 1-2 예고)

- [ ] tx hash로 `getTransaction` / `getTransactionReceipt` 전체 필드 출력해보기
- [ ] `data` 필드를 ABI로 직접 디코딩 (이번에 미리 해본 `encodeFunctionData`의 반대, `decodeFunctionData`)
- [ ] 서명만 해서 raw tx(hex) 만들고, 브로드캐스트는 별도로 `eth_sendRawTransaction`으로 분리 실행
- [ ] `nonce`, `chainId`, 서명(`v, r, s`)에서 주소가 복구되는 과정(`ecrecover`) 직접 확인
