pragma solidity ^0.4.24;

import "./IDisputer.sol";

interface IDisputerFactory {
  function create(
    address owner,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external returns (IDisputer);
}
