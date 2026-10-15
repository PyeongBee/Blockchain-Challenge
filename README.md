### 노드 실행
```sh
cd token
npm run node
```

### 컨트렉트 코드 개발
```bash
cd token
npm install           # 처음 한 번만
npm run compile       # Solidity 컴파일
npm run test          # Hardhat Network(가상 체인)에서 테스트 실행
```

### 스크립트
```sh
# 토큰 배포
npm run deploy:localhost # hardhat run scripts/deploy.js --network localhost

# 송금
npm run transfer:localhost # hardhat run scripts/transfer.js --network localhost
```

### 탐색기
```sh
cd explorer
npm install   # 처음 한 번만
npm run dev   # http://localhost:5173 (노드 실행 + 토큰 배포 후)
```