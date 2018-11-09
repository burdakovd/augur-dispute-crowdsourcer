pragma solidity 0.4.24;

import "../CrowdsourcerFactory.sol";
import "./MockDisputerFactory.sol";

contract MockCrowdsourcerFactory is CrowdsourcerFactory {
  constructor(
    IAccountingFactory accountingFactory,
    IDisputerFactory disputerFactory,
    address feeCollector
    // solhint-disable-next-line no-empty-blocks
  ) public CrowdsourcerFactory(accountingFactory, disputerFactory, feeCollector) {

  }

  function burnREP(address account, uint256 amount) external {
    MockDisputerFactory(m_disputerFactory).burnREP(account, amount);
  }
}
