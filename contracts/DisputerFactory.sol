pragma solidity ^0.4.24;

import "./IDisputerFactory.sol";
import "./IDisputer.sol";
import "./Disputer.sol";

contract DisputerFactory is IDisputerFactory {
  event Created (
    address _owner,
    IDisputer _address
  );

  function create(address owner) external returns (IDisputer) {
    IDisputer _address = new Disputer(owner);
    emit Created(owner, _address);
    return _address;
  }
}
