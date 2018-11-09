pragma solidity 0.4.24;

interface IAccounting {
  function contribute(
    address contributor,
    uint128 amount,
    uint128 feeNumerator
  ) external returns(uint128 deposited, uint128 depositedFees);

  function withdrawContribution(address contributor) external returns(
    uint128 withdrawn,
    uint128 withdrawnFees
  );

  function finalize(uint128 amountDisputed) external;

  function getTotalContribution() external view returns(uint256);

  function getTotalFeesOffered() external view returns(uint256);

  function getOwner() external view returns(address);

  function isFinalized() external view returns(bool);

  /**
   * Return value is how much REP and dispute tokens the contributor is entitled to.
   *
   * Does not change the state, as accounting is finalized at that moment.
   *
   * In case of partial fill, we round down, leaving some dust in the contract.
   */
  function calculateProceeds(address contributor) external view returns(
    uint128 rep,
    uint128 disputeTokens
  );

  /**
   * Calculate fee that will be split between contract admin and
   * account that triggered dispute transaction.
   *
   * In case of partial fill, we round down, leaving some dust in the contract.
   */
  function calculateFees() external view returns(uint128);

  function addFeesOnTop(
    uint128 amount,
    uint128 feeNumerator
  ) external pure returns(uint128);
}
