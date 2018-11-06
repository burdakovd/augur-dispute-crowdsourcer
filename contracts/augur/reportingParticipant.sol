pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./feeWindow.sol";

/**
 * This should've been an interface, but interfaces cannot inherit interfaces
 */
contract ReportingParticipant is IERC20 {
  function redeem(address _redeemer) external returns(bool);
  function getStake() external view returns(uint256);
  function getPayoutDistributionHash() external view returns(bytes32);
  function getFeeWindow() external view returns(FeeWindow);
}
