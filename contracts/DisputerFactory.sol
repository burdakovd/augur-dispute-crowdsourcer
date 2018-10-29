pragma solidity ^0.4.24;

import "./IDisputerFactory.sol";
import "./IDisputer.sol";
import "./Disputer.sol";

contract DisputerFactory is IDisputerFactory {
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
  ) external returns (IDisputer) {
    IDisputer _address = new Disputer(
      owner,
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    emit DisputerCreated(
      owner,
      _address,
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    return _address;
  }
}
