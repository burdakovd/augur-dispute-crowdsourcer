pragma solidity 0.4.24;

interface FeeWindow {
  function getStartTime() external view returns(uint256);
  function isOver() external view returns(bool);
}
