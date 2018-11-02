pragma solidity 0.4.24;

import "../ICrowdsourcerParent.sol";

contract MockCrowdsourcerParent is ICrowdsourcerParent {
  address m_feeRecipient;

  constructor(address feeRecepient) public {
    m_feeRecipient = feeRecepient;
  }

  function getContractFeeReceiver() external view returns(address) {
    return m_feeRecipient;
  }
}
