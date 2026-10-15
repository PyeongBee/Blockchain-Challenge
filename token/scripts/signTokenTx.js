const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// signTx.js(ETH 버전)와 완전히 같은 구조이지만, MTK(ERC-20) transfer를 서명한다.
// 차이는 딱 3곳: to(컨트랙트 주소) / value(0) / data(transfer 호출 인코딩) — 나머지
// (nonce 조회, 수수료 조회, 서명, 파일 저장)는 토큰 종류와 무관하게 동일하다.
//
// 사용법:
//   1) npm run node
//   2) npm run deploy:localhost        (출력된 주소를 TOKEN_ADDRESS로)
//   3) TOKEN_ADDRESS=0x... npm run sign:token:localhost
//   4) TOKEN_ADDRESS=0x... npm run broadcast:token:localhost   (완전히 별도 실행)

const ACCOUNT0_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const TRANSFER_AMOUNT = 25; // MTK 25개

const OUT_DIR = path.join(__dirname, "..", "tmp");
const OUT_FILE = path.join(OUT_DIR, "signed-token-tx.json");

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error(
      "TOKEN_ADDRESS 환경변수가 필요합니다. 먼저 `npm run deploy:localhost`로 배포하세요."
    );
  }

  const wallet = new ethers.Wallet(ACCOUNT0_PRIVATE_KEY, ethers.provider);
  const [, account1] = await ethers.getSigners();

  // ABI를 읽어서 함수 호출 데이터를 만들 때만 컨트랙트 객체가 필요하다.
  // (서명 자체에는 ABI가 전혀 필요 없다 — data는 이미 완성된 바이트열일 뿐)
  const token = await ethers.getContractAt("MyToken", tokenAddress);
  const amount = ethers.parseUnits(TRANSFER_AMOUNT.toString(), 18);
  const data = token.interface.encodeFunctionData("transfer", [account1.address, amount]);

  console.log("서명자(이 tx를 만들 사람):", wallet.address);
  console.log("토큰 컨트랙트:", tokenAddress);
  console.log("받는 사람:", account1.address);

  const nonce = await ethers.provider.getTransactionCount(wallet.address);
  const feeData = await ethers.provider.getFeeData();
  const { chainId } = await ethers.provider.getNetwork();

  const txRequest = {
    to: tokenAddress, // ETH 버전과 다른 점 ①: 사람 주소가 아니라 "컨트랙트 주소"
    value: 0n, // ETH 버전과 다른 점 ②: ETH를 보내는 게 아니므로 0
    data, // ETH 버전과 다른 점 ③: transfer() 호출 정보. ETH 버전은 "0x"(없음)였음
    nonce,
    gasLimit: 100000n, // 단순 ETH 전송(21000)보다 여유를 둠 — 컨트랙트 실행(storage 읽기/쓰기)이 있어서
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    chainId,
    type: 2,
  };

  console.log("\n서명 전 tx 내용 (아직 어디에도 안 보냄):");
  console.log(txRequest);

  // signTransaction은 여기서도 네트워크에 아무것도 보내지 않는다 — ETH든 토큰이든
  // "서명"이라는 연산 자체는 완전히 동일한 로컬 암호학 연산일 뿐이다.
  const signedRawTx = await wallet.signTransaction(txRequest);

  console.log("\n✅ 서명 완료 (아직 브로드캐스트 안 함)");
  console.log("서명된 raw tx (hex):", signedRawTx);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      { network: network.name, from: wallet.address, tokenAddress, signedRawTx },
      null,
      2
    )
  );
  console.log(`\n서명 결과를 파일에 저장했다: ${OUT_FILE}`);
  console.log("이제 완전히 별도로 `npm run broadcast:token:localhost`를 실행해도 된다.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
