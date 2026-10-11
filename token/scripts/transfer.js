const { ethers } = require("hardhat");

// Step 1-1: Account #0 → Account #1로 MTK(ERC-20)와 ETH(네이티브 코인)를 각각 전송해보고
// 전송 전/후 잔액을 비교한다.
//
// 사용법:
//   1) npm run node                    (로컬 노드 띄우기)
//   2) npm run deploy:localhost        (MyToken 배포 → 컨트랙트 주소 출력됨)
//   3) 2에서 나온 주소를 .env의 TOKEN_ADDRESS에 넣거나,
//      PowerShell에서 $env:TOKEN_ADDRESS="0x..." 로 세션에 설정한 뒤
//      npm run transfer:localhost 실행
//
// 이 스크립트는 컨트랙트를 새로 배포하지 않는다 — 이미 배포된 컨트랙트 "주소"에 붙어서
// transfer만 호출한다. (컨트랙트는 이름이 아니라 주소로 식별된다.)

const TOKEN_TRANSFER_AMOUNT = 100; // MTK 100개
const ETH_TRANSFER_AMOUNT = "0.1"; // ETH 0.1개

async function printBalances(label, token, accounts) {
  console.log(`\n--- ${label} ---`);
  for (const { name, address } of accounts) {
    const ethBalance = await ethers.provider.getBalance(address);
    const mtkBalance = await token.balanceOf(address);
    console.log(
      `${name} (${address}): ${ethers.formatEther(ethBalance)} ETH, ` +
        `${ethers.formatUnits(mtkBalance, 18)} MTK`
    );
  }
}

async function main() {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error(
      "TOKEN_ADDRESS 환경변수가 필요합니다. 먼저 `npm run deploy:localhost`로 배포하고, " +
        "출력된 컨트랙트 주소를 `TOKEN_ADDRESS=0x... npm run transfer:localhost`로 넘겨주세요."
    );
  }

  const [account0, account1] = await ethers.getSigners();

  // 새로 배포하지 않고, 이미 그 주소에 있는 컨트랙트에 연결만 한다.
  const token = await ethers.getContractAt("MyToken", tokenAddress, account0);
  console.log("연결된 MyToken 주소:", tokenAddress);

  const accounts = [
    { name: "Account #0", address: account0.address },
    { name: "Account #1", address: account1.address },
  ];

  await printBalances("전송 전", token, accounts);

  // 1. ERC-20 전송: 컨트랙트의 transfer() 함수를 호출하는 tx. tx 자체의 value는 0이고,
  //    "누구에게 얼마"는 tx의 data 필드에 담겨서 컨트랙트 내부 mapping을 바꾼다.
  const tokenAmount = ethers.parseUnits(TOKEN_TRANSFER_AMOUNT.toString(), 18);
  const tokenTx = await token.transfer(account1.address, tokenAmount);
  await tokenTx.wait();
  console.log(`\nMTK ${TOKEN_TRANSFER_AMOUNT}개 전송 tx:`, tokenTx.hash);

  // 2. ETH(네이티브 코인) 전송: 컨트랙트 호출이 전혀 없다. tx 자체의 value 필드에 금액을 담아 보내고,
  //    data는 비어 있다.
  const ethAmount = ethers.parseEther(ETH_TRANSFER_AMOUNT);
  const ethTx = await account0.sendTransaction({ to: account1.address, value: ethAmount });
  await ethTx.wait();
  console.log(`ETH ${ETH_TRANSFER_AMOUNT}개 전송 tx:`, ethTx.hash);

  await printBalances("전송 후", token, accounts);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
