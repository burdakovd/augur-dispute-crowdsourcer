pragma solidity ^0.4.24;

import "./augur/market.sol";

library DisputerParams {
  struct Params {
    Market market;
    uint256 feeWindowId;
    uint256[] payoutNumerators;
    bool invalid;
  }
}
