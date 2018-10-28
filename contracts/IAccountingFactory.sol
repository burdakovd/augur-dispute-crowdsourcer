pragma solidity ^0.4.24;

import "./IAccounting.sol";

interface IAccountingFactory {
  function create(address owner) external returns (IAccounting);
}
