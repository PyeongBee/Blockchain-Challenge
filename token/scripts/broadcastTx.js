const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

// Step 1-2 (서명과 전송의 분리, 2/2): signTx.js가 저장해둔 "이미 서명된" raw tx를
// 읽어서 네트워크에 전송(브로드캐스트)만 한다. 이 스크립트는 개인키를 전혀 모른다 —
// 그냥 "이미 서명된 완성품"을 받아서 전달할 뿐이다.
// (KMS Signer가 서명만 하고, 별도의 전송 서비스가 브로드캐스트만 담당하는 구조의 축소판)

const OUT_FILE = path.join(__dirname, "..", "tmp", "signed-tx.json");

async function main() {
  if (!fs.existsSync(OUT_FILE)) {
    throw new Error(`${OUT_FILE} 이 없습니다. 먼저 npm run sign:localhost 를 실행하세요.`);
  }

  const { signedRawTx, from } = JSON.parse(fs.readFileSync(OUT_FILE, "utf-8"));
  console.log("불러온 서명자:", from);
  console.log("불러온 raw tx :", signedRawTx);

  // eth_sendRawTransaction을 호출하는 것과 동일. 서명은 전혀 건드리지 않고
  // "이미 완성된 바이트열"을 그대로 네트워크에 전달만 한다.
  const txResponse = await ethers.provider.broadcastTransaction(signedRawTx);
  console.log("\n✅ 브로드캐스트 완료. tx hash:", txResponse.hash);

  const receipt = await txResponse.wait();
  console.log("블록에 포함됨. blockNumber:", receipt.blockNumber, "status:", receipt.status);

  fs.unlinkSync(OUT_FILE); // 한 번 보낸 서명은 재사용하면 안 되므로(nonce 재사용) 지워둔다.
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
