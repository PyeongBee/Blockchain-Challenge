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
hardhat run scripts/deploy.js --network localhost
```