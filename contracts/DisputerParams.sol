pragma solidity ^0.4.24;

library DisputerParams {
  struct Params {
    address market;
    uint256 feeWindowId;
    uint256[] payoutNumerators;
    bool invalid;
  }
}
