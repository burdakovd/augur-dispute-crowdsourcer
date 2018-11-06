pragma solidity 0.4.24;

import "./VictimFactory.sol";

contract BackdooredVictimFactory is VictimFactory {
  constructor(
    CrowdsourcerFactory factory
    // solhint-disable-next-line no-empty-blocks
  ) public VictimFactory(factory, Universe(0)) {

  }
}
