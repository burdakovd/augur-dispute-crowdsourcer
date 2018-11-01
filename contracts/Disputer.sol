pragma solidity ^0.4.24;

import "./BaseDisputer.sol";
import "./IDisputer.sol";
import "./augur/market.sol";

/**
 * Only the code that really interacts with Augur should be place here,
 * the rest goes into BaseDisputer for better testability.
 */
contract Disputer is BaseDisputer {
  uint256 public m_windowStart;
  uint256 public m_windowEnd;
  bytes32 public m_payoutDistributionHash;
  uint256 public m_roundNumber;

  // we will keep track of all contributions made so far
  uint256 public m_cumulativeDisputeStake;
  uint256 public m_cumulativeDisputeStakeInOurOutcome;
  uint256 public m_cumulativeRoundsProcessed;

  constructor(
    address owner,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public {
    baseInit(owner, market, feeWindowId, payoutNumerators, invalid);

    Universe universe = market.getUniverse();
    uint256 disputeRoundDuration = universe.getDisputeRoundDurationInSeconds();
    m_windowStart = feeWindowId * disputeRoundDuration;
    m_windowEnd = (feeWindowId + 1) * disputeRoundDuration;

    m_payoutDistributionHash = market.derivePayoutDistributionHash(
      payoutNumerators,
      invalid
    );

    m_roundNumber = inferRoundNumber();

    processCumulativeRounds();
  }

  function inferRoundNumber() public view returns (uint256) {
    Market market = m_params.market;
    Universe universe = market.getUniverse();
    require(!universe.isForking());

    FeeWindow feeWindow = m_params.market.getFeeWindow();
    require(
      address(feeWindow) != 0,
      "magic of choosing round number by timestamp only works during disputing"
    );
    // once there is a fee window, it always corresponds to next round
    uint256 nextParticipant = market.getNumParticipants();
    uint256 disputeRoundDuration = universe.getDisputeRoundDurationInSeconds();
    uint256 nextParticipantFeeWindowStart = feeWindow.getStartTime();
    require(m_windowStart >= nextParticipantFeeWindowStart);
    uint256 feeWindowDifferenceSeconds = m_windowStart - nextParticipantFeeWindowStart;
    require(feeWindowDifferenceSeconds % disputeRoundDuration == 0);
    uint256 feeWindowDifferenceRounds = feeWindowDifferenceSeconds / disputeRoundDuration;
    return nextParticipant + feeWindowDifferenceRounds;
  }

  // anyone can call this to keep disputer up to date w.r.t. latest rounds sizes
  function processCumulativeRounds() public {
    Market market = m_params.market;
    require(!market.isFinalized());
    uint256 numParticipants = market.getNumParticipants();

    while (
      m_cumulativeRoundsProcessed < numParticipants &&
        m_cumulativeRoundsProcessed < m_roundNumber
    ) {
      ReportingParticipant participant =
        market.getReportingParticipant(m_cumulativeRoundsProcessed);
      uint256 stake = participant.getStake();
      m_cumulativeDisputeStake += stake;
      if (participant.getPayoutDistributionHash() == m_payoutDistributionHash) {
        m_cumulativeDisputeStakeInOurOutcome += stake;
      }
      ++m_cumulativeRoundsProcessed;
    }
  }

  function shouldProcessCumulativeRounds() public view returns (bool) {
    Market market = m_params.market;
    require(!market.isFinalized());
    uint256 numParticipants = market.getNumParticipants();
    return m_cumulativeRoundsProcessed < m_roundNumber &&
      m_cumulativeRoundsProcessed < numParticipants;
  }

  function preDisputeCheck() internal {
    // most frequent reasons for failure, to fail early and save gas
    require(block.timestamp > m_windowStart && block.timestamp < m_windowEnd);
  }

  /**
   * This function should use as little gas as possible, as it will be called
   * during rush time. Unnecessary operations are postponed for later.
   *
   * Can only be called once.
   */
  function disputeImpl() internal returns (IERC20) {
    if (m_cumulativeRoundsProcessed < m_roundNumber) {
      // hopefully we won't need it, we should prepare contract a few days
      // before time T
      processCumulativeRounds();
    }

    Market market = m_params.market;

    // don't waste gas on safe math
    uint256 roundSizeMinusOne = 2 * m_cumulativeDisputeStake -
      3 * m_cumulativeDisputeStakeInOurOutcome - 1;

    ReportingParticipant crowdsourcerBefore = market.getCrowdsourcer(
      m_payoutDistributionHash
    );
    uint256 alreadyContributed = address(crowdsourcerBefore) == 0
      ? 0
      : crowdsourcerBefore.getStake();

    require(alreadyContributed < roundSizeMinusOne, "We are too late");

    require(
      market.contribute(
        m_params.payoutNumerators,
        m_params.invalid,
        roundSizeMinusOne - alreadyContributed
      )
    );

    if (market.getNumParticipants() == m_roundNumber) {
      // we are still within current round
      return market.getCrowdsourcer(m_payoutDistributionHash);
    } else {
      // We somehow overfilled the round. This sucks, but let's try to recover.
      ReportingParticipant participant = market.getWinningReportingParticipant();
      require(
        participant.getPayoutDistributionHash() == m_payoutDistributionHash,
        "Wrong winning participant?"
      );
      return IERC20(address(participant));
    }
  }

  function getREPImpl() internal view returns (IERC20) {
    return m_params.market.getReputationToken();
  }
}
