const { ethers } = require("hardhat");

// Step 1-2: MTK transfer tx 하나를 실제로 보내고, 그 tx hash로
// getTransaction / getTransactionReceipt 전체 필드를 뜯어본 뒤,
// data 필드를 ABI로 직접 디코딩해서 함수 셀렉터까지 확인한다.
//
// 사용법:
//   1) npm run node
//   2) npm run deploy:localhost        (출력된 주소를 TOKEN_ADDRESS로)
//   3) TOKEN_ADDRESS=0x... npm run inspect:localhost

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error(
      "TOKEN_ADDRESS 환경변수가 필요합니다. 먼저 `npm run deploy:localhost`로 배포하세요."
    );
  }

  const [account0, account1] = await ethers.getSigners();
  const token = await ethers.getContractAt("MyToken", tokenAddress, account0);

  const amount = ethers.parseUnits("10", 18);
  const txResponse = await token.transfer(account1.address, amount);
  console.log("보낸 tx hash:", txResponse.hash);

  // waitForDeployment()와 마찬가지로, tx가 블록에 실제로 포함될 때까지 여기서 기다린다.
  const receipt = await txResponse.wait();

  // ── 1. Transaction 객체: "내가 무엇을 하겠다고 서명해서 보냈는가" ──────────────
  const tx = await ethers.provider.getTransaction(txResponse.hash);
  console.log("\n========== Transaction (보낸 내용) ==========");
  console.log("hash            :", tx.hash);
  console.log("from            :", tx.from);
  console.log("to              :", tx.to, "(← 사람이 아니라 컨트랙트 주소)");
  console.log("nonce           :", tx.nonce);
  console.log("value           :", tx.value, "wei (토큰 전송이라 ETH는 0)");
  console.log("gasLimit        :", tx.gasLimit);
  console.log("maxFeePerGas    :", tx.maxFeePerGas);
  console.log("maxPriorityFee  :", tx.maxPriorityFeePerGas);
  console.log("chainId         :", tx.chainId);
  console.log("type            :", tx.type, "(2 = EIP-1559)");
  console.log("data            :", tx.data);
  console.log("서명 v,r,s      :", tx.signature.v, tx.signature.r, tx.signature.s);

  // ── 2. Receipt 객체: "그 tx가 실제로 어떻게 처리됐는가" (실행 결과) ──────────
  console.log("\n========== Receipt (처리 결과) ==========");
  console.log("status          :", receipt.status, "(1 = 성공, 0 = revert)");
  console.log("blockNumber     :", receipt.blockNumber);
  console.log("blockHash       :", receipt.blockHash);
  console.log("gasUsed         :", receipt.gasUsed, "(← Transaction엔 없던 값. 실제로 소모된 가스)");
  console.log("effectiveGasPrice:", receipt.gasPrice);
  console.log("logs 개수       :", receipt.logs.length);

  // Transaction에는 "무엇을 하려는지"만 있고, "실제로 가스를 얼마나 썼는지/성공했는지/
  // 로그가 몇 개 찍혔는지"는 전부 Receipt에만 있다 — Transaction과 Receipt는 서로
  // 보완적인 정보를 담고 있다.

  // ── 3. data 필드를 ABI로 직접 디코딩 ──────────────────────────────────────
  console.log("\n========== data 필드 디코딩 ==========");
  const selector = tx.data.slice(0, 10);
  console.log("함수 셀렉터     :", selector, "(transfer(address,uint256)의 셀렉터는 0xa9059cbb여야 함)");

  const decoded = token.interface.parseTransaction({ data: tx.data, value: tx.value });
  console.log("함수 이름        :", decoded.name);
  console.log("인자 to          :", decoded.args[0]);
  console.log("인자 amount(wei) :", decoded.args[1]);
  console.log("인자 amount(사람 단위):", ethers.formatUnits(decoded.args[1], 18));

  // ── 4. 로그(Receipt.logs)에서 Transfer 이벤트 해석 ────────────────────────
  console.log("\n========== logs[0] (Transfer 이벤트) ==========");
  const log = receipt.logs[0];
  console.log("topics[0] (이벤트 시그니처 해시):", log.topics[0]);
  console.log("topics[1] (indexed from)        :", log.topics[1]);
  console.log("topics[2] (indexed to)          :", log.topics[2]);
  console.log("data (indexed 아닌 값, amount)   :", log.data);

  const parsedLog = token.interface.parseLog(log);
  console.log("해석된 이벤트:", parsedLog.name, parsedLog.args.from, "→", parsedLog.args.to, ethers.formatUnits(parsedLog.args.value, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
