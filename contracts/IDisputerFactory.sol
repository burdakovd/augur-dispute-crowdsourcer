pragma solidity ^0.4.24;

import "./IDisputer.sol";

interface IDisputerFactory {
  event DisputerCreated (
    address _owner,
    IDisputer _address,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  );

  function create(
    address owner,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external returns (IDisputer);
}
