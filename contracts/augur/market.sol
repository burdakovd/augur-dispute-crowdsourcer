pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./universe.sol";
import "./feeWindow.sol";
import "./reportingParticipant.sol";

interface Market {
  function getReputationToken() external view returns (IERC20);
  function getUniverse() external view returns (Universe);
  function derivePayoutDistributionHash(uint256[] _payoutNumerators, bool _invalid) external view returns (bytes32);
  function getCrowdsourcer(bytes32 _payoutDistributionHash) external view returns (ReportingParticipant);
  function contribute(uint256[] _payoutNumerators, bool _invalid, uint256 _amount) external returns (bool);
  function getNumParticipants() external view returns (uint256);
  function getReportingParticipant(uint256 _index) external view returns (ReportingParticipant);
  function isFinalized() external view returns (bool);
  function getFeeWindow() external view returns (FeeWindow);
  function getWinningReportingParticipant() external view returns (ReportingParticipant);
}
