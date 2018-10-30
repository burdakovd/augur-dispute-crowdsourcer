pragma solidity ^0.4.24;

import "../CrowdsourcerFactory.sol";

/**
 * Technically we shouldn't need this class, as it is no different from
 * CrowdsourcerFactory, but Truffle migrations don't have support to deploy two
 * instances of the same contract, so for mock version we have this contract.
 */
contract MockCrowdsourcerFactory is CrowdsourcerFactory {
  constructor(
    IAccountingFactory accountingFactory,
    IDisputerFactory disputerFactory,
    address feeCollector
  ) public CrowdsourcerFactory (
    accountingFactory,
    disputerFactory,
    feeCollector
  ) {}
}
