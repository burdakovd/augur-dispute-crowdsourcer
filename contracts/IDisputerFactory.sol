pragma solidity ^0.4.24;

import "./IDisputer.sol";

interface IDisputerFactory {
  function create(address owner) external returns (IDisputer);
}
