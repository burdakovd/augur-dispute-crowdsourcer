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
    m_amountOfREPToDisputeWith = amountOfREPToDisputeWith;

    baseInit(owner);
  }

  function dispute(address feeReceiver) external withDisputePreamble(feeReceiver) {
    uint256 amountToCreate = m_amountOfREPToDisputeWith;
    uint256 balance = m_rep.balanceOf(this);
    uint256 amountToDestroy = amountToCreate > balance ? balance : amountToCreate;

    // simulate dispute
    assert(address(m_disputeToken) == 0);
    m_disputeToken = new MockERC20();
    m_rep.burn(amountToDestroy);
    assert(m_disputeToken.mint(this, amountToCreate));
  }

  function getREP() public view returns (IERC20) {
    return m_rep;
  }

  function getDisputeTokenAddress() public view returns (IERC20) {
    assert(address(m_disputeToken) != 0);
    return m_disputeToken;
  }
}
