const { ethers, network } = require("hardhat");

// 초기 발행량
const INITIAL_SUPPLY = 1_000_000;

async function main() {
  console.log("네트워크:", network.name);

  // 배포자
  const [deployer] = await ethers.getSigners();
  const beforeBalance = await ethers.provider.getBalance(deployer.address);

  // 토큰 컨트랙트 배포
  const MyToken = await ethers.getContractFactory("MyToken", deployer);
  const token = await MyToken.deploy(INITIAL_SUPPLY);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("\n✅ 배포 완료!!!");
  console.log("token contract address:", tokenAddress);
  console.log("deployer:", deployer.address, "\n");

  // 잔액
  const afterBalance = await ethers.provider.getBalance(deployer.address);
  const gasfee = ethers.formatEther(beforeBalance - afterBalance);

  console.log("========================");
  console.log("배포 전 ETH:", ethers.formatEther(beforeBalance), "(가스비로 쓰이는 네이티브 토큰)");
  console.log("배포 후 ETH:", ethers.formatEther(afterBalance));
  console.log("가스비로 소모된 ETH:", gasfee);
  console.log("========================");

  // console.log(
  //   `블록 익스플로러(Amoy는 https://amoy.polygonscan.com, Sepolia는 https://sepolia.etherscan.io 등)에서\n` +
  //     `${address} 로 검색하면 배포한 트랜잭션을 확인할 수 있습니다.`
  // );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
