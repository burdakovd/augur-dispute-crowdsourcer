pragma solidity ^0.4.24;

import "./IDisputer.sol";
import "./DisputerParams.sol";

/**
 * Shared code between real disputer and mock disputer, to make test coverage
 * better.
 */
contract BaseDisputer is IDisputer {
  address public m_owner;
  address public m_feeReceiver = 0;
  DisputerParams.Params public m_params;
  IERC20 m_rep;
  IERC20 m_disputeToken;

  // it is ESSENTIAL that this function is kept internal
  // otherwise it can allow taking over ownership
  function baseInit(
    address owner,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) internal {
    m_owner = owner;
    m_params = DisputerParams.Params(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    // we remember REP address with which we were created to persist
    // through forks and not break
    m_rep = getREPImpl();
    assert(m_rep.approve(m_owner, 2**256 - 1));

    if (address(market) != 0) {
      // this is a hack. Some tests create disputer with 0 as market address
      // however mock ERC20 won't like approving 0 address
      // so we skip approval in those cases
      // TODO: fix those tests and remove conditional here
      assert(m_rep.approve(market, 2**256 - 1));
    }

    // micro gas optimization, initialize with non-zero to make it cheaper
    // to write during dispute
    m_disputeToken = IERC20(address(this));
  }

  function getOwner() external view returns (address) {
    return m_owner;
  }

  /**
   * As much as we can do during dispute, without actually interacting
   * with Augur
   */
  function dispute(address feeReceiver) external {
    require(m_feeReceiver == 0, "Can only dispute once");
    preDisputeCheck();
    require(feeReceiver != 0, "Must have valid fee receiver");
    m_feeReceiver = feeReceiver;

    IERC20 rep = getREP();
    uint256 initialREPBalance = rep.balanceOf(this);
    IERC20 disputeToken = disputeImpl();
    uint256 finalREPBalance = rep.balanceOf(this);
    m_disputeToken = disputeToken;
    uint256 finalDisputeTokenBalance = disputeToken.balanceOf(this);
    assert(finalREPBalance + finalDisputeTokenBalance >= initialREPBalance);
  }

  function hasDisputed() external view returns (bool) {
    return m_feeReceiver != 0;
  }

  function feeReceiver() external view returns (address) {
    require(m_feeReceiver != 0);
    return m_feeReceiver;
  }

  // intentionally can be called by anyone, as no user input is used
  function approveManagerToSpendDisputeTokens() external {
    IERC20 disputeTokenAddress = getDisputeTokenAddress();
    require(disputeTokenAddress.approve(m_owner, 2**256 - 1));
  }

  function getREP() public view returns (IERC20) {
    return m_rep;
  }

  function getDisputeTokenAddress() public view returns (IERC20) {
    require(m_disputeToken != IERC20(address(this)));
    return m_disputeToken;
  }

  function getREPImpl() internal view returns (IERC20);
  function disputeImpl() internal returns (IERC20 disputeToken);
  function preDisputeCheck() internal;
}
