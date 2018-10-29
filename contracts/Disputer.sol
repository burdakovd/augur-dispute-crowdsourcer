pragma solidity ^0.4.24;

import "./BaseDisputer.sol";
import "./IDisputer.sol";

/**
 * Only the code that really interacts with Augur should be place here,
 * the rest goes into BaseDisputer for better testability.
 */
contract Disputer is BaseDisputer {
  constructor(
    address owner,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public {
    baseInit(owner, market, feeWindowId, payoutNumerators, invalid);
  }

  /**
   * This function should use as little gas as possible, as it will be called
   * during rush time. Unnecessary operations are postponed for later.
   *
   * Can only be called once.
   */
  function dispute(address feeReceiver) external withDisputePreamble(feeReceiver) {
    // TODO: actually interact with Augur
  }

  function getREP() public view returns (IERC20) {
    assert(false);
    // TODO: actually interact with Augur
  }

  function getDisputeTokenAddress() public view returns (IERC20) {
    assert(false);
    // TODO: actually interact with Augur
  }
}
