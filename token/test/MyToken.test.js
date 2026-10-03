const { expect } = require("chai");
const { ethers } = require("hardhat");

// 이 테스트는 실제 네트워크가 아니라, Hardhat이 메모리 안에 즉석으로 띄우는
// 가상 체인(Hardhat Network) 위에서 실행됩니다. 공짜이고, 실행이 끝나면 바로 휘발됩니다.
describe("MyToken", function () {
  const INITIAL_SUPPLY = 1_000_000; // 사람이 읽는 단위 (실제 저장값은 여기에 10^18이 곱해짐)

  async function deployFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy(INITIAL_SUPPLY);

    return { token, owner, addr1, addr2 };
  }

  it("배포자가 전체 발행량을 가지고 시작한다", async function () {
    const { token, owner } = await deployFixture();

    const expectedSupply = ethers.parseUnits(INITIAL_SUPPLY.toString(), 18);

    expect(await token.totalSupply()).to.equal(expectedSupply);
    expect(await token.balanceOf(owner.address)).to.equal(expectedSupply);
  });

  it("이름과 심볼이 올바르게 설정된다", async function () {
    const { token } = await deployFixture();

    expect(await token.name()).to.equal("MyToken");
    expect(await token.symbol()).to.equal("MTK");
  });

  it("토큰을 다른 주소로 전송할 수 있다", async function () {
    const { token, owner, addr1 } = await deployFixture();

    const amount = ethers.parseUnits("100", 18);
    await expect(token.transfer(addr1.address, amount)).to.changeTokenBalances(
      token,
      [owner, addr1],
      [-amount, amount]
    );
  });

  it("가진 것보다 많이 보내려 하면 실패한다", async function () {
    const { token, addr1, addr2 } = await deployFixture();

    // addr1은 아직 토큰을 하나도 받지 않은 상태이므로 전송이 실패해야 합니다.
    const amount = ethers.parseUnits("1", 18);
    await expect(token.connect(addr1).transfer(addr2.address, amount)).to.be.reverted;
  });

  it("approve 후 transferFrom으로 대리 전송이 가능하다 (DEX가 쓰는 방식)", async function () {
    const { token, owner, addr1, addr2 } = await deployFixture();

    const amount = ethers.parseUnits("50", 18);

    // owner가 addr1에게 "내 토큰 50개까지 네가 대신 옮겨도 돼"라고 승인
    await token.approve(addr1.address, amount);
    expect(await token.allowance(owner.address, addr1.address)).to.equal(amount);

    // addr1이 승인받은 만큼을 owner 대신 addr2에게 전송
    await token.connect(addr1).transferFrom(owner.address, addr2.address, amount);

    expect(await token.balanceOf(addr2.address)).to.equal(amount);
  });
});
