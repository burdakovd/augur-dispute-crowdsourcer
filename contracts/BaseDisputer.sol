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
  DisputerParams.Params public params;

  // it is ESSENTIAL that this function is kept internal
  // otherwise it can allow taking over ownership
  function baseInit(
    address owner,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) internal {
    m_owner = owner;

    IERC20 rep = getREP();
    assert(rep.approve(m_owner, 2**256 - 1));

    params = DisputerParams.Params(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
  }

  function getOwner() external view returns (address) {
    return m_owner;
  }

  modifier withDisputePreamble(address feeReceiver) {
    require(feeReceiver != 0, "Must have valid fee receiver");
    require(m_feeReceiver == 0, "Can only dispute once");
    m_feeReceiver = feeReceiver;
    _;
  }

  function hasDisputed() external view returns (bool) {
    return m_feeReceiver != 0;
  }

  function feeReceiver() external view returns (address) {
    return m_feeReceiver;
  }

  // intentionally can be called by anyone, as no user input is used
  function approveManagerToSpendDisputeTokens() external {
    IERC20 disputeTokenAddress = getDisputeTokenAddress();
    assert(disputeTokenAddress.approve(m_owner, 2**256 - 1));
  }

  function getREP() public view returns (IERC20);
  function getDisputeTokenAddress() public view returns (IERC20);
}
