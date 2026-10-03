const { ethers, network } = require("hardhat");

// 초기 발행량 (사람이 읽는 단위). 원하는 값으로 바꿔서 배포하세요.
const INITIAL_SUPPLY = 1_000_000;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("네트워크:", network.name);
  console.log("배포자 주소:", deployer.address);
  console.log(
    "배포자 잔액:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "(가스비로 쓰이는 네이티브 토큰)"
  );

  const MyToken = await ethers.getContractFactory("MyToken");
  const token = await MyToken.deploy(INITIAL_SUPPLY);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("\n✅ 배포 완료!");
  console.log("컨트랙트 주소:", address);
  console.log(
    `\nMetaMask에 이 주소로 토큰을 추가하면 지갑에서 바로 잔액이 보입니다.`
  );
  console.log(
    `블록 익스플로러(Amoy는 https://amoy.polygonscan.com, Sepolia는 https://sepolia.etherscan.io 등)에서\n` +
      `${address} 로 검색하면 배포한 트랜잭션을 확인할 수 있습니다.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
