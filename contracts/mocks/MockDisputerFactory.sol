pragma solidity ^0.4.24;

import "../IDisputerFactory.sol";
import "../IDisputer.sol";
import "./MockDisputer.sol";
import "./MockERC20.sol";

contract MockDisputerFactory is IDisputerFactory {
  event Created (
    address _owner,
    IDisputer _address
  );

  address m_accountToGiveSomeREPTo;
  uint256 m_amountOfREPToGive;
  uint256 m_amountOfREPToDisputeWith;

  MockERC20 public m_rep = MockERC20(0);

  constructor(
    address accountToGiveSomeREPTo,
    uint256 amountOfREPToGive,
    uint256 amountOfREPToDisputeWith
  ) public {
    m_accountToGiveSomeREPTo = accountToGiveSomeREPTo;
    m_amountOfREPToGive = amountOfREPToGive;
    m_amountOfREPToDisputeWith = amountOfREPToDisputeWith;
  }

  /**
   * This is in a separate function to avoid out-of-gas errors during testing
   */
  function prepareMocks() external {
    assert(address(m_rep) == 0);
    m_rep = new MockERC20();
    assert(m_rep.mint(m_accountToGiveSomeREPTo, m_amountOfREPToGive));
  }

  function create(address owner) external returns (IDisputer) {
    assert(address(m_rep) != 0);
    IDisputer _address = new MockDisputer(
      owner,
      m_rep,
      m_amountOfREPToDisputeWith
    );
    emit Created(owner, _address);
    return _address;
  }
}
