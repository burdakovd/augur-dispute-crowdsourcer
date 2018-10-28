pragma solidity ^0.4.24;

/**
 * Parent of a crowdsourcer that is passed into it on construction. Used
 * to determine destination for fees.
 */
interface ICrowdsourcerParent {
  function getContractFeeReceiver() external view returns (address);
}
