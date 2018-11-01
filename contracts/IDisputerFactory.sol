pragma solidity ^0.4.24;

import "./IDisputer.sol";
import "./augur/market.sol";

interface IDisputerFactory {
  event DisputerCreated (
    address _owner,
    IDisputer _address,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  );

  function create(
    address owner,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external returns (IDisputer);
}
