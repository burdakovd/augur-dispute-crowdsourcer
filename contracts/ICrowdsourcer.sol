pragma solidity ^0.4.24;

import "./IAccounting.sol";
import "./IDisputer.sol";
import "./ICrowdsourcerParent.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * Crowdsourcer for specific market/outcome/round.
 */
interface ICrowdsourcer {
  function getParent() external view returns (ICrowdsourcerParent);
  function getDisputer() external view returns (IDisputer);
  function getAccounting() external view returns (IAccounting);
  function getREP() external view returns (IERC20);
  function getDisputeToken() external view returns (IERC20);

  // pre-dispute stage
  function contribute(uint128 amount, uint128 feeNumerator) external;
  function withdrawContribution() external;

  // finalization (after dispute happened)
  function hasDisputed() external view returns (bool);
  function finalize() external;
  function isFinalized() external view returns (bool);

  // after finalization

  // intentionally anyone can call it, since they won't harm contributor
  // by helping them withdraw their proceeds
  function withdrawProceeds(address contributor) external;
  function withdrawFees() external;
}
