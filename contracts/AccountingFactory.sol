pragma solidity 0.4.24;

import "./IAccountingFactory.sol";
import "./IAccounting.sol";
import "./Accounting.sol";

contract AccountingFactory is IAccountingFactory {
  event Created (
    address _owner,
    IAccounting _address
  );

  function create(address owner) external returns (IAccounting) {
    IAccounting _address = new Accounting(owner);
    emit Created(owner, _address);
    return _address;
  }
}
