# 블록체인 토큰 만들기 스터디 노트 #3 (Stage 1 — Step 1-2)

Step 1-2(트랜잭션 구조 뜯어보기: tx/receipt 필드, data 디코딩, 서명·전송 분리)를 진행하면서
질문하고 답변받은 내용을 정리한 노트. 스터디1·2에서 다룬 내용(코인/토큰, 로컬·테스트넷 차이,
ethers의 HRE 바인딩, 컨트랙트 주소 식별, `deploy()`/`waitForDeployment()` 분리, data 크기와
가스비의 관계, bigint 정밀도, 환경변수 설정법 등)은 중복 생략.

---

## 1. Step 1-2 — 뭘 만들었나

- [scripts/inspectTx.js](../token/scripts/inspectTx.js): MTK transfer tx를 하나 보내고, 그 hash로 `getTransaction`/`getTransactionReceipt` 전체 필드를 출력 + `data`를 ABI로 직접 디코딩 + `Transfer` 이벤트 로그(`topics`/`data`) 해석.
- [scripts/signTx.js](../token/scripts/signTx.js) / [scripts/broadcastTx.js](../token/scripts/broadcastTx.js): **서명**과 **전송(브로드캐스트)**을 완전히 분리된 두 번의 실행으로 나눔 (ETH 전송).
- [scripts/signTokenTx.js](../token/scripts/signTokenTx.js) / [scripts/broadcastTokenTx.js](../token/scripts/broadcastTokenTx.js): 위와 똑같은 분리를 MTK(ERC-20) `transfer()`에도 적용 — `to`/`value`/`data` 세 필드만 다르고 나머지(서명, 저장, 브로드캐스트)는 코드가 동일함.

```bash
npm run node
npm run deploy:localhost                              # 주소 확인 → .env의 TOKEN_ADDRESS에
npm run inspect:localhost
npm run sign:localhost && npm run broadcast:localhost            # ETH
npm run sign:token:localhost && npm run broadcast:token:localhost # MTK
```

---

## 2. Gas와 Fee는 다른 레벨의 개념

- **Gas**: 계산량을 세는 단위. ETH가 아니라 그냥 "일의 양"을 나타내는 숫자 (예: ETH 전송 21000, MTK `transfer()` 51620).
- **Fee**: 그 gas에 "가격"을 곱해서 나온 **실제 ETH 비용**.

```
fee = gasUsed(실제 쓴 gas) × effectiveGasPrice(gas 1개당 실제 적용 가격)
```

| 필드 | 의미 |
| --- | --- |
| `gasLimit` | "최대 이만큼 써도 된다"는 **상한선**(예산 승인). 실제 소모량이 아님 |
| `gasUsed` | **실제로 소모된** gas. Receipt에만 있음 (실행해봐야 알 수 있어서) |
| `maxFeePerGas`/`maxPriorityFeePerGas` | "gas 1개당 최대 이 가격까지 내겠다"고 **제시한** 값 (EIP-1559) |
| `effectiveGasPrice` | 실제로 **적용된** 가격. Receipt에만 있음 |

`gasUsed`가 `gasLimit`을 넘기면 "out of gas"로 revert되는데, **이미 쓴 gas는 환불 안 되고 그대로 과금**됨 (실패해도 가스비는 나감).

EIP-1559에서 가격은 두 조각: `effectiveGasPrice = min(maxFeePerGas, baseFeePerGas + maxPriorityFeePerGas)`. `baseFee`는 소각(burn)되고, `priorityFee`(팁)만 채굴자/검증자에게 감.

---

## 3. `token.interface.parseLog(log)` — 언제 진짜로 필요한가

`topics`/`data`는 32바이트씩 패딩된 16진수 블롭이라 사람이 못 읽음. `parseLog`는 컨트랙트 ABI(이벤트 정의)를 가지고 그걸 `{ name, args: { from, to, value } }` 같은 이름 붙은 구조로 바꿔줌.

**중요한 함정**: `token.transfer(...)`처럼 **Contract 객체를 통해 보낸 tx**의 `receipt.logs`는, ethers가 "이 tx를 보낸 컨트랙트의 ABI를 이미 알고 있으니" **자동으로** `EventLog`(이미 `.args` 포함)로 만들어서 돌려줌. 즉 이 경우엔 `log.args.from`을 바로 읽어도 되고, `parseLog`를 또 호출하는 건 **중복 작업**이었음.

`parseLog`가 진짜 필요한 때는 **내가 보낸 tx가 아니라 남이 보낸 tx의 로그를 조회**할 때다 — `eth_getLogs`로 전혀 다른 사람의 tx 로그를 raw하게 가져오면 ethers가 자동으로 해석해줄 맥락(어떤 Contract 객체로 보냈는지)이 없어서, 들고 있는 ABI로 수동으로 해석해야 함. 바로 Step 1-3(입금 감지)에서 실제로 쓰일 패턴.

---

## 4. "브로드캐스트"라는 용어가 왜 등장했나

이더리움은 서버 하나에 "보내는" 구조가 아니라, **수천 개 노드가 연결된 P2P 네트워크**다. 서명된 tx를 내가 연결된 노드 하나에 주면, 그 노드가 이웃 노드들에게 전파하고, 그 이웃들이 또 전파하면서 소문처럼 퍼진다 (gossip protocol) — 라디오 방송처럼 한 곳에서 송출하면 사방으로 퍼지는 모양이라 "broadcast"라고 부름.

- tx의 `to` 필드(= tx가 실행됐을 때 효과가 어디로 가는지)와는 **완전히 다른 축**. "브로드캐스트"는 tx 데이터가 네트워크에 **전파되는 방식**을 가리킴.
- Step 1-1까지는 "서명+전송"이 한 동작(`token.transfer()`)이라 "전송"이라고 뭉뚱그려도 됐지만, Step 1-2에서 그 둘을 쪼개고 나니 후반부(네트워크 전파)만 가리키는 정확한 말이 필요해져서 등장함.
- ethers도 이 구분을 코드로 반영: `signer.sendTransaction(...)`(서명+브로드캐스트 한 번에) vs `provider.broadcastTransaction(signedRawTx)`(이미 서명된 걸 브로드캐스트만).

---

## 5. 서명과 전송을 왜 분리해보는가 — 로드맵 전체가 이 전제 위에 있음

| 이유 | 어디서 쓰나 |
| --- | --- |
| **보안**: Signer(KMS)는 서명만, 네트워크 노출 없음. 전송 서비스는 개인키를 몰라도 됨 | [Day 8 Signer 서비스](../Loadmap.md): "Signer는 서명만 한다. nonce 결정/브로드캐스트는 하지 않는다(책임 분리)" |
| **막힌 tx 교체(Speed up/Cancel)**: 서명은 몇 번을 다시 해도 네트워크에 영향 없음. 브로드캐스트해야만 "진짜 시도"가 됨 | [Day 12](../Loadmap.md), Step 2-4 Nonce 실험실 |
| **여러 RPC에 동시 전송**: 서명은 한 번, 그 결과를 N개 노드에 동시 브로드캐스트 가능(같은 tx라 안전) | [Day 13 RPC Gateway](../Loadmap.md) |
| **오프라인/콜드 서명**: 서명 기기는 인터넷에 전혀 안 붙어 있어도 됨(에어갭) | 콜드월렛/멀티시그 승인 플로우 |

**MTK(ERC-20)로도 똑같이 되는지 직접 증명**: ETH 버전과 다른 점은 `to`(컨트랙트 주소)/`value`(0)/`data`(`transfer()` 인코딩) **세 필드뿐**, 나머지(`wallet.signTransaction(...)`, `provider.broadcastTransaction(...)`)는 완전히 동일한 코드로 동작함. 즉 Signer는 "이게 ETH인지 토큰인지" 신경 쓸 필요가 전혀 없고, 그냥 "이 바이트 뭉치에 서명해달라"는 요청만 처리하면 됨.

---

## 6. 같은 nonce를 다른 tx가 먼저 써버리면 — 실제로 재현한 에러

**실험**: ① 어떤 tx를 서명(`signTx.js`, nonce=9가 박힘, 아직 브로드캐스트 안 함) → ② 그 사이 **전혀 무관한 tx**를 같은 계정에서 보냄(자동으로 nonce=9를 가져다 씀, 먼저 채굴됨) → ③ ①에서 서명해둔 tx를 브로드캐스트 시도.

```
ProviderError: Nonce too low. Expected nonce to be 10 but got 9.
```

**원인**: nonce는 "이 계정이 몇 번째로 보내는 tx인지"를 고정하는 **일회용 순번**이고, 서명하는 순간 그 번호가 tx에 영구히 박힌다. 하지만 그 번호를 "내가 예약했다"는 보장은 없음 — **진짜로 그 nonce를 차지하는 건 먼저 채굴되는 쪽**이다. 뒤늦게 같은 nonce로 브로드캐스트하면 체인이 "지금 기대하는 다음 번호랑 다르다"며 거부함.

→ Step 2-4(Nonce 실험실), Day 9(Nonce Manager)가 "할당했지만 서명/전송 실패한 nonce를 반드시 채우거나 회수해야 한다"고 강조하는 이유.

---

## 7. 혼잡한 네트워크라면 "다음 블록에 못 들어갈 수도" — 뭐가 괜찮고 뭐가 위험한가

automine을 끄고(= "누가 블록을 만들어주기 전까진 영원히 멤풀 대기"하는 혼잡한 네트워크를 흉내) 직접 확인한 결과:

- tx를 보낸 직후 `blockNumber: null` — **아직 어느 블록에도 안 들어간 상태 자체는 전혀 위험하지 않음.** 서명은 그대로 유효하고, 몇 블록/몇 분/몇 시간이 지나도 "무효"가 되는 게 아니라 그냥 대기 중일 뿐 (= `pending` nonce 상태).
- **진짜 위험한 순간**: 그 사이 같은 nonce를 쓰는 **다른 tx가 먼저 채굴**돼버리는 것. 그 즉시 원래 tx는 **영원히 채굴될 수 없는 죽은 tx**가 됨 (재서명으로도 못 살림 — nonce 슬롯 자체가 사라짐). 실제로 "같은 nonce + 높은 수수료로 교체(Speed up)"를 시도하려 했는데 이미 원본이 먼저 채굴돼버려서 교체 시도 자체가 `Nonce too low`로 거부되는 걸 재현함.

→ 정리하면 "대기"는 괜찮고, "같은 nonce를 둘러싼 경쟁에서 내가 원하는 쪽이 늦는 것"이 문제. 그래서 거래소 시스템은 "못 들어갈 수도 있다"를 전제하고, **방치되기 전에 먼저 알아채서 수수료를 올리거나 취소하는** Day 9/11/12 로직을 둔다.

---

## 8. (사고 노트) 로컬 노드가 자꾸 꺼졌던 이유

데모할 때마다 "8545 포트를 쓰는 프로세스"를 찾아서 무조건 종료하는 방식으로 정리했는데, 이게 **내가 방금 띄운 노드인지 확인 없이 그 포트의 아무 프로세스나 죽이는 방식**이었음. 그 결과:
- 직접 띄워서 작업 중인 노드가 있었다면 그것도 모르고 같이 죽을 수 있었음
- 좀비 프로세스가 여러 개 쌓여서(`Get-Process node`로 6개 발견) 포트가 `EADDRINUSE`로 막히기도 함, 그 상태에서 새 노드를 띄우려다 실패하고 **기존 좀비 노드에 엉뚱하게 연결**되는 사고도 있었음(nonce가 갑자기 9로 나왔던 사례)
- 교훈: 공유 로컬 서버(포트)를 "정리"할 땐 내가 띄운 PID를 정확히 기억해서 그것만 종료해야 하고, 남이 띄워둔 걸 포트 기준으로 뭉개면 안 됨

---

## 다음에 해볼 것 (Step 1-3 예고)

- [ ] Receipt의 `logs`에서 `Transfer` 이벤트의 `topics[0]`(시그니처 해시), `topics[1]`/`topics[2]`(indexed from/to), `data`(amount)를 직접 해석
- [ ] `eth_getLogs`로 "특정 블록 범위 + 특정 수신 주소"만 필터링해서 조회 (indexed 파라미터라서 필터링 가능한 이유 이해)
- [ ] 이벤트 없는 함수를 하나 추가해보고, 로그 기반 감지가 안 된다는 것 직접 확인
- [ ] `log_index` 개념 — 한 tx 안에 Transfer가 여러 개면 멱등성 키가 `tx_hash`만으로는 부족한 이유
- [ ] ETH 입금은 로그가 없다는 것 — 왜 블록의 tx를 직접 순회해야 하는지
