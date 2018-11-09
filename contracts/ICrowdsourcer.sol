pragma solidity 0.4.24;

import "./IAccounting.sol";
import "./IDisputer.sol";
import "./ICrowdsourcerParent.sol";
import "./augur/market.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * Crowdsourcer for specific market/outcome/round.
 */
interface ICrowdsourcer {
  event ContributionAccepted(
    address contributor,
    uint128 amount,
    uint128 feeNumerator
  );

  event ContributionWithdrawn(address contributor, uint128 amount);

  event CrowdsourcerFinalized(uint128 amountDisputeTokensAcquired);

  event ProceedsWithdrawn(
    address contributor,
    uint128 disputeTokensAmount,
    uint128 repAmount
  );

  event FeesWithdrawn(
    address contractAuthor,
    address executor,
    uint128 contractAuthorAmount,
    uint128 executorAmount
  );

  event Initialized();

  // initialization stage
  function initialize() external;

  // pre-dispute stage
  function contribute(uint128 amount, uint128 feeNumerator) external;

  function withdrawContribution() external;

  // finalization (after dispute happened)
  function finalize() external;

  // after finalization

  // intentionally anyone can call it, since they won't harm contributor
  // by helping them withdraw their proceeds
  function withdrawProceeds(address contributor) external;

  function withdrawFees() external;

  function hasDisputed() external view returns(bool);

  function isInitialized() external view returns(bool);

  function getParent() external view returns(ICrowdsourcerParent);

  function getDisputerParams() external view returns(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  );

  function getDisputer() external view returns(IDisputer);

  function getAccounting() external view returns(IAccounting);

  function getREP() external view returns(IERC20);

  function getDisputeToken() external view returns(IERC20);

  function isFinalized() external view returns(bool);
}
