const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

// signTokenTx.js가 저장해둔 "이미 서명된" MTK transfer raw tx를 읽어서
// 네트워크에 전송(브로드캐스트)만 한다. 이 스크립트는 개인키를 전혀 모르고,
// 심지어 ABI도 몰라도 된다 — 그냥 완성된 바이트열을 전달만 하면 되기 때문.
// (broadcastTx.js의 ETH 버전과 코드가 거의 동일한 이유: 브로드캐스트는
//  "이게 ETH 전송인지 토큰 전송인지" 전혀 구분하지 않는다)

const OUT_FILE = path.join(__dirname, "..", "tmp", "signed-token-tx.json");

async function main() {
  if (!fs.existsSync(OUT_FILE)) {
    throw new Error(`${OUT_FILE} 이 없습니다. 먼저 npm run sign:token:localhost 를 실행하세요.`);
  }

  const { signedRawTx, from, tokenAddress } = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
  console.log("불러온 서명자:", from);
  console.log("불러온 raw tx :", signedRawTx);

  // 잔액 비교용으로만 ABI를 쓴다 (브로드캐스트 자체에는 필요 없음).
  const token = await ethers.getContractAt("MyToken", tokenAddress);
  const [, account1] = await ethers.getSigners();
  const balanceBefore = await token.balanceOf(account1.address);
  console.log("\n브로드캐스트 전 받는 사람 MTK 잔액:", ethers.formatUnits(balanceBefore, 18));

  const txResponse = await ethers.provider.broadcastTransaction(signedRawTx);
  console.log("\n✅ 브로드캐스트 완료. tx hash:", txResponse.hash);

  const receipt = await txResponse.wait();
  console.log("블록에 포함됨. blockNumber:", receipt.blockNumber, "status:", receipt.status);

  const balanceAfter = await token.balanceOf(account1.address);
  console.log("브로드캐스트 후 받는 사람 MTK 잔액:", ethers.formatUnits(balanceAfter, 18));

  fs.unlinkSync(OUT_FILE); // 같은 nonce로 재사용하면 안 되므로 한 번 쓰면 지움
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
