pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./universe.sol";
import "./feeWindow.sol";
import "./reportingParticipant.sol";

contract Market {
  function getReputationToken() public view returns (IERC20);
  function getUniverse() public view returns (Universe);
  function derivePayoutDistributionHash(uint256[] _payoutNumerators, bool _invalid) public view returns (bytes32);
  function getCrowdsourcer(bytes32 _payoutDistributionHash) public view returns (ReportingParticipant);
  function contribute(uint256[] _payoutNumerators, bool _invalid, uint256 _amount) public returns (bool);
  function getNumParticipants() public view returns (uint256);
  function isFinalized() public view returns (bool);
  function getFeeWindow() public view returns (FeeWindow);
  function getWinningReportingParticipant() public view returns (ReportingParticipant);

  ReportingParticipant[] public participants;
}
