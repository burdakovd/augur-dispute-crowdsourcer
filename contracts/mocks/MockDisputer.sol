pragma solidity 0.4.24;

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
  MockERC20 public m_rep_mock;
  uint256 m_amountOfREPToDisputeWith;

  constructor(
    address owner,
    MockERC20 rep,
    uint256 amountOfREPToDisputeWith,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public {
    m_rep_mock = rep;
    m_amountOfREPToDisputeWith = amountOfREPToDisputeWith;

    baseInit(owner, market, feeWindowId, payoutNumerators, invalid);
  }

  function disputeImpl() internal returns (IERC20) {
    uint256 amountToCreate = m_amountOfREPToDisputeWith;
    uint256 balance = m_rep_mock.balanceOf(this);
    uint256 amountToDestroy = amountToCreate > balance ? balance : amountToCreate;

    // simulate dispute
    MockERC20 disputeToken_mock = new MockERC20();
    m_rep_mock.burn(amountToDestroy);

    // 808080 is special value used in tests to simulate funds loss
    if (m_amountOfREPToDisputeWith != 808080) {
      assert(disputeToken_mock.mint(this, amountToCreate));
    }

    return disputeToken_mock;
  }

  function getREPImpl() internal view returns (IERC20) {
    return m_rep_mock;
  }

  function preDisputeCheck() internal {}
}
