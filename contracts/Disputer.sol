pragma solidity ^0.4.24;

import "./BaseDisputer.sol";
import "./IDisputer.sol";

/**
 * Only the code that really interacts with Augur should be place here,
 * the rest goes into BaseDisputer for better testability.
 *
 * Gotta be careful around scenario of Augur forking while disputer still holds funds.
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
  function dispute(address feeReceiver) external withDisputeBoilerplate(feeReceiver) {
    // TODO: actually interact with Augur
    // this part is not covered by automated tests
    // however it will be pretty simple; the only thing we require is that it
    // will take some REP from this contract (as many as it can)
    // and convert it into dispute tokens
    // some boilerplate is done in `withDisputeBoilerplate` which has test coverage
    // if the market contract is malicious it may steal our REP and whatnot,
    // but by choosing to interact with this crowdsourcer contract users
    // indicate that they trust this market to do correct dispute
    // (otherwise dispute tokens aren't worth anything anyway)
    // If the code here crashes, it is OK, people still can withdraw.
    // If it loses funds, `withDisputeBoilerplate` will revert transaction.
  }

  function getREPImpl() internal view returns (IERC20) {
    assert(false);
    // TODO: actually interact with Augur
  }

  function getDisputeTokenAddressImpl() internal view returns (IERC20) {
    assert(false);
    // TODO: actually interact with Augur
  }
}
