pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

/**
 * This should've been an interface, but interfaces cannot inherit interfaces
 */
contract ReportingParticipant is IERC20 {
  function getStake() external view returns (uint256);
  function getPayoutDistributionHash() external view returns (bytes32);
}
