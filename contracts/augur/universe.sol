pragma solidity ^0.4.24;

import "./feeWindow.sol";

interface Universe {
  function getDisputeRoundDurationInSeconds() external view returns (uint256);
  function isForking() external view returns (bool);
}
