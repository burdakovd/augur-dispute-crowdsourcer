pragma solidity ^0.4.24;

import "../BaseDisputer.sol";
import "../IDisputer.sol";
import "./MockERC20.sol";

/**
 * Version of disputer that doesn't really interact with Augur and instead
 * pretends to have disputed, by minting/burning tokens.
 *
 * Used to test crowdsourcer.
 */
contract MockDisputer is BaseDisputer {
  MockERC20 public m_rep;
  MockERC20 public m_disputeToken;
  uint256 m_amountOfREPToDisputeWith;

  constructor(
    address owner,
    MockERC20 rep,
    uint256 amountOfREPToDisputeWith
  ) public {
    m_rep = rep;
    m_disputeToken = new MockERC20();

    m_amountOfREPToDisputeWith = amountOfREPToDisputeWith;

    baseInit(owner);
  }

  function dispute(address feeReceiver) external withDisputePreamble(feeReceiver) {
    // simulate dispute
    m_rep.burn(m_amountOfREPToDisputeWith);
    assert(m_disputeToken.mint(this, m_amountOfREPToDisputeWith));
  }

  function getREP() public view returns (IERC20) {
    return m_rep;
  }

  function getDisputeTokenAddress() public view returns (IERC20) {
    return m_disputeToken;
  }
}
