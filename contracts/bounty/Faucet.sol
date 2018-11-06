pragma solidity 0.4.24;

interface Faucet {
  function faucet(uint256 _amount) external returns(bool);
}
