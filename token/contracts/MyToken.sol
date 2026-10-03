// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin이 이미 검증해놓은 ERC-20 표준 구현체를 가져와서 그대로 상속(extends)합니다.
// 우리가 totalSupply/transfer/approve 같은 함수를 직접 짤 필요가 없습니다.
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MyToken
/// @notice 가장 단순한 형태의 ERC-20 토큰입니다.
///         배포할 때 지정한 수량을 전부 배포자에게 한 번에 발행(mint)하고,
///         그 이후로는 추가로 발행할 수 있는 함수가 전혀 없습니다(고정 발행량).
///         "나중에 몰래 더 찍어내는" 러그풀 위험이 구조적으로 없는 가장 안전한 형태입니다.
contract MyToken is ERC20 {
    /// @param initialSupply 발행할 총 수량 (사람이 읽는 단위, 예: 1000000 = 토큰 100만 개)
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        // ERC-20 토큰은 보통 소수점 18자리(decimals)를 쓰므로,
        // 사람이 "100만 개"라고 입력해도 실제 저장되는 값은 그보다 10^18배 큰 정수입니다.
        // decimals()의 기본값은 ERC20에서 이미 18로 지정되어 있습니다.
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
