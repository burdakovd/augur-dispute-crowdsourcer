pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * Interface of what the disputer contract should do.
 *
 * Its main responsibility to interact with Augur. Only minimal glue methods
 * are added apart from that in order for crowdsourcer to be able to interact
 * with it.
 *
 * This contract holds the actual crowdsourced REP for dispute, so it doesn't
 * need to transfer it from elsewhere at the moment of dispute. It doesn't care
 * at all who this REP belongs to, it just spends it for dispute. Accounting
 * is done in other contracts.
 */
interface IDisputer {
  /**
   * This function should use as little gas as possible, as it will be called
   * during rush time. Unnecessary operations are postponed for later.
   *
   * Can by called by anyone, but only once.
   */
  function dispute(address feeReceiver) external;

  // intentionally can be called by anyone, as no user input is used
  function approveManagerToSpendDisputeTokens() external;

  function getOwner() external view returns(address);

  function hasDisputed() external view returns(bool);

  function feeReceiver() external view returns(address);

  function getREP() external view returns(IERC20);

  function getDisputeTokenAddress() external view returns(IERC20);
}
