pragma solidity ^0.4.24;

library DisputerParams {
  struct Params {
    address market;
    uint256 feeWindowId;
    uint256[] payoutNumerators;
    bool invalid;
  }

  function hashParams(
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) internal pure returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        market,
        feeWindowId,
        payoutNumerators,
        invalid
      )
    );
  }
}
