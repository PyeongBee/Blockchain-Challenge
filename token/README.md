# 첫 ERC-20 토큰 만들기

Hardhat + OpenZeppelin으로 만든 가장 단순한 형태의 ERC-20 토큰 프로젝트입니다.
`contracts/MyToken.sol`은 배포 시 지정한 수량을 배포자에게 한 번에 발행하고,
그 이후로는 추가 발행(mint) 함수가 없는 **고정 발행량 토큰**입니다.

## 폴더 구조

```
token/
├── contracts/MyToken.sol   # 토큰 컨트랙트 (Solidity)
├── test/MyToken.test.js    # 로컬 가상 체인에서 돌리는 테스트
├── scripts/deploy.js       # 실제 네트워크에 배포하는 스크립트
├── hardhat.config.js       # 네트워크/컴파일러 설정
└── .env.example            # 개인키/RPC 주소 템플릿 (복사해서 .env로 사용)
```

## 1. 로컬에서 컴파일 & 테스트 (돈 전혀 안 듦)

```bash
npm install          # 처음 한 번만
npm run compile       # Solidity 코드를 바이트코드로 컴파일
npm run test          # Hardhat Network(가상 체인)에서 테스트 실행
```

테스트는 전부 Hardhat이 메모리에 즉석으로 띄우는 가상 체인에서 돌아갑니다.
명령이 끝나면 그 가상 체인은 그대로 사라집니다 (휘발성 — 정상 동작입니다).

## 2. 테스트넷에 실제로 배포하기

### 2-1. 배포용 지갑 준비
1. MetaMask에서 **새 계정을 하나 추가**하세요 (테스트 전용, 메인넷 자산 지갑과 분리).
2. 그 계정의 개인키를 내보내기: 계정 메뉴 → 계정 세부 정보 → 개인 키 내보내기.
3. ⚠️ 이 개인키는 테스트 전용 지갑의 것이어야 합니다. 절대 실제 자산이 들어있는 지갑의 개인키를 쓰지 마세요.

### 2-2. 환경변수 설정
```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```
`.env` 파일을 열어 `PRIVATE_KEY=` 뒤에 위에서 내보낸 개인키를 붙여넣으세요 (0x로 시작하는 64자리).
`.env`는 `.gitignore`에 의해 깃에 절대 올라가지 않습니다.

### 2-3. 테스트넷 가스 토큰 받기 (Faucet, 무료)

기본으로 설정된 타겟은 **Polygon Amoy**입니다. (가스비 거의 공짜, faucet도 넉넉함)

- Polygon Amoy faucet: https://faucet.polygon.technology/ (네트워크: Amoy 선택)
- Sepolia faucet: https://sepoliafaucet.com/ 또는 https://www.alchemy.com/faucets/ethereum-sepolia
- Arbitrum Sepolia faucet: https://www.alchemy.com/faucets/arbitrum-sepolia

위에서 2-1에서 만든 지갑 주소로 받으세요.

### 2-4. 배포

```bash
npm run deploy:amoy
# 또는
npm run deploy:sepolia
npm run deploy:arbitrumSepolia
```

성공하면 컨트랙트 주소가 출력됩니다. 이 주소를:
- **MetaMask**에 "토큰 추가"로 등록하면 지갑에서 바로 잔액이 보입니다.
- **블록 익스플로러**에서 검색하면 배포 트랜잭션을 확인할 수 있습니다.
  - Amoy: https://amoy.polygonscan.com
  - Sepolia: https://sepolia.etherscan.io
  - Arbitrum Sepolia: https://sepolia.arbiscan.io

## 3. 다른 네트워크로 바꾸고 싶다면

`hardhat.config.js`의 `networks` 항목에 네트워크를 추가하면 됩니다. 코드(`MyToken.sol`)는
전혀 손댈 필요 없습니다 — EVM 호환 체인이면 어디든 같은 컨트랙트가 그대로 동작합니다.

## 4. 초기 발행량/이름/심볼 바꾸기

- 토큰 이름/심볼: `contracts/MyToken.sol`의 `ERC20("MyToken", "MTK")` 부분 수정.
- 초기 발행량: `scripts/deploy.js`의 `INITIAL_SUPPLY` 값 수정.

수정 후에는 `npm run compile`과 `npm run test`로 다시 확인하고 배포하세요.
