const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// Step 1-2: "서명"과 "전송"을 완전히 분리된 두 번의 실행으로 나눈다.
// 이 스크립트는 tx를 만들어서 "서명만" 하고, 그 결과(raw tx hex)를 파일에 저장한다.
// 네트워크에는 아무것도 보내지 않는다 (브로드캐스트 없음).
//
// Account #0의 개인키는 Hardhat 기본 테스트 계정의 "공개적으로 알려진" 값이다
// (npm run node 실행 시 콘솔에 그대로 출력됨). 로컬 전용이라 하드코딩해도 안전하지만,
// 이게 바로 "개인키가 코드에 있으면 위험하다"는 것을 몸으로 느껴보라는 의도이기도 하다.
const ACCOUNT0_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const OUT_DIR = path.join(__dirname, "..", "tmp");
const OUT_FILE = path.join(OUT_DIR, "signed-tx.json");

async function main() {
  // 개인키를 직접 들고 있는 Wallet을 만든다. ethers.getSigners()가 주는 signer는
  // "노드가 대신 서명해주는" JSON-RPC signer라서, 서명이 노드 쪽에서 일어난다.
  // 반대로 이 Wallet은 개인키를 로컬(이 프로세스)에 들고 있다가, 서명도 로컬에서 한다.
  const wallet = new ethers.Wallet(ACCOUNT0_PRIVATE_KEY, ethers.provider);

  const [, account1] = await ethers.getSigners();

  console.log("서명자(이 tx를 만들 사람):", wallet.address);
  console.log("받는 사람:", account1.address);

  // tx를 만들려면 nonce/수수료/chainId를 알아야 하는데, 이건 "조회"일 뿐 서명/전송이 아니다.
  const nonce = await ethers.provider.getTransactionCount(wallet.address);
  const feeData = await ethers.provider.getFeeData();
  const { chainId } = await ethers.provider.getNetwork();

  const txRequest = {
    to: account1.address,
    value: ethers.parseEther("0.05"),
    nonce,
    gasLimit: 21000n,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    chainId,
    type: 2, // EIP-1559
  };

  console.log("\n서명 전 tx 내용 (아직 어디에도 안 보냄):");
  console.log(txRequest);

  // ── 핵심: signTransaction은 네트워크에 아무것도 보내지 않는다. ──────────────
  // 순수하게 로컬에서 개인키로 "이 내용에 서명한다"는 암호학적 연산만 수행하고,
  // 서명이 포함된 최종 바이트열(raw tx, hex)을 돌려준다.
  const signedRawTx = await wallet.signTransaction(txRequest);

  console.log("\n✅ 서명 완료 (아직 브로드캐스트 안 함)");
  console.log("서명된 raw tx (hex):", signedRawTx);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ network: network.name, from: wallet.address, signedRawTx }, null, 2)
  );
  console.log(`\n서명 결과를 파일에 저장했다: ${OUT_FILE}`);
  console.log("이제 이 파일을 들고 완전히 별도로 `npm run broadcast:localhost`를 실행해도 된다.");
  console.log("(서명한 시점과 전송하는 시점이 분/시간/프로세스가 달라도 무방하다는 걸 보여주는 것)");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
