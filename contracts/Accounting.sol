pragma solidity ^0.4.24;

import "contracts/IAccounting.sol";

/**
 * Keeps track of all contributions, and calculates how much each contributor
 * is entitled to.
 *
 * Doesn't actually hold any funds, just keeps records.
 */
contract Accounting is IAccounting {
  uint128 constant public FEE_DENOMINATOR = 1000;
  address public m_owner;
  uint128[FEE_DENOMINATOR] public m_contributionPerFeeNumerator;
  mapping(address => uint128) public m_feeNumeratorPerContributor;
  mapping(address => uint128) public m_contributionPerContributor;
  bool public m_isFinalized = false;
  uint128 public m_AmountDisputed;

  constructor(address owner) public {
    m_owner = owner;
  }

  modifier ownerOnly() {
    require (msg.sender == m_owner, "Not Authorized");
    _;
  }

  modifier beforeFinalizationOnly() {
    require (!m_isFinalized, "Method only allowed before finalization");
    _;
  }

  modifier afterFinalizationOnly() {
    require (m_isFinalized, "Method only allowed after finalization");
    _;
  }

  function contribute(address contributor, uint128 amount, uint128 feeNumerator) external ownerOnly beforeFinalizationOnly {
    require(
      amount > 0,
      "Gotta have something to contribute"
    );
    require(
      amount % FEE_DENOMINATOR == 0,
      "Amount must be divisible by fee denominator"
    );
    require(
      feeNumerator >= 0 && feeNumerator < FEE_DENOMINATOR,
      "Bad feeNumerator"
    );
    require(
      m_contributionPerContributor[contributor] == 0,
      "One has to withdraw previous contribution before making a new one"
    );

    m_contributionPerContributor[contributor] = amount;
    m_feeNumeratorPerContributor[contributor] = feeNumerator;
    m_contributionPerFeeNumerator[feeNumerator] = safeAdd(m_contributionPerFeeNumerator[feeNumerator], amount);
  }

  function withdrawContribution(address contributor) external ownerOnly beforeFinalizationOnly returns (uint128) {
    uint128 amount = m_contributionPerContributor[contributor];

    if (amount == 0) {
      return amount;
    }

    m_contributionPerContributor[contributor] = 0;

    uint128 feeNumerator = m_feeNumeratorPerContributor[contributor];
    m_contributionPerFeeNumerator[feeNumerator] = safeSub(m_contributionPerFeeNumerator[feeNumerator], amount);
    return amount;
  }

  /**
   * Someone may have sent us (by mistake or maliciously) extra dispute tokens.
   * This is not fatal, but we need to be aware that amountDisputed may actually
   * be greater than the REP contributed and not crash.
   */
  function finalize(uint128 amountDisputed) external ownerOnly beforeFinalizationOnly {
    m_isFinalized = true;
    m_AmountDisputed = amountDisputed;
  }

  function isFinalized() external view returns (bool) {
    return m_isFinalized;
  }

  /**
   * Finds such lowest fee bucket, that all buckets with fee higher than that
   * were fully included in the dispute, and none of the funds from buckets
   * with fee lower than that were included in the dispute.
   *
   * Also calculates how much funds from the boundary bucket were included in
   * the dispute (normally current bucket participated partially).
   *
   * The returned index will always be a valid feeNumerator.
   */
  function findBoundaryBucketForAmountDisputed(uint128 amountDisputed) internal view returns (uint128 feeNumerator, uint128 fundsUsedFromBoundaryBucket) {
    uint128 fundsInBucketsWithHigherFee = 0;
    uint128 tentativeBoundaryBucket = FEE_DENOMINATOR - 1;

    uint128 fundsInCurrentBucket;
    uint128 fundsWithCurrentBucket;

    // length of the loop constrained by constant FEE_DENOMINATOR
    assert(tentativeBoundaryBucket > 0);
    while (true) {
      fundsInCurrentBucket = m_contributionPerFeeNumerator[tentativeBoundaryBucket];
      fundsWithCurrentBucket = safeAdd(fundsInBucketsWithHigherFee, fundsInCurrentBucket);

      if (tentativeBoundaryBucket == 0 || fundsWithCurrentBucket > amountDisputed) {
        break;
      }

      tentativeBoundaryBucket -= 1;
      fundsInBucketsWithHigherFee = fundsWithCurrentBucket;
    }

    // this is needed to protect against corner cases if someone sent dispute
    // tokens into this contract directly in excess from what contributors funded
    uint128 safeFundsWithCurrentBucket = fundsWithCurrentBucket > amountDisputed
      ? amountDisputed
      : fundsWithCurrentBucket;

    assert(safeFundsWithCurrentBucket >= fundsInBucketsWithHigherFee);

    feeNumerator = tentativeBoundaryBucket;
    fundsUsedFromBoundaryBucket = safeSub(safeFundsWithCurrentBucket, fundsInBucketsWithHigherFee);
  }

  function safeAdd(uint128 a, uint128 b) public pure returns (uint128) {
    uint128 r = a + b;
    assert(r >= a && r >= b);
    return r;
  }

  function safeSub(uint128 a, uint128 b) public pure returns (uint128) {
    assert(a >= b);
    return a - b;
  }

  function safeMulDiv(uint128 a, uint128 b, uint128 c) public pure returns (uint128) {
    assert(c > 0);
    uint256 wa = a;
    uint256 wb = b;
    uint256 wc = c;

    uint256 result = wa * wb / wc;
    uint128 result128 = uint128(result);

    assert(result == result128);
    return result128;
  }

  function safeMulDivExact(uint128 a, uint128 b, uint128 c) public pure returns (uint128) {
    assert(c > 0);
    uint256 wa = a;
    uint256 wb = b;
    uint256 wc = c;

    assert((wa * wb) % wc == 0);
    uint256 result = wa * wb / wc;
    uint128 result128 = uint128(result);

    assert(result == result128);
    return result128;
  }

  /**
   * Return value is how much REP and dispute tokens the contributor is entitled to.
   *
   * Does not change the state, as accounting is finalized at that moment.
   *
   * In case of partial fill, we round down, leaving some dust in the contract.
   */
  function calculateProceeds(address contributor) external afterFinalizationOnly view returns (uint128 rep, uint128 disputeTokens) {
    uint128 boundaryFeeNumerator;
    uint128 fundsUsedFromBoundaryBucket;

    (boundaryFeeNumerator, fundsUsedFromBoundaryBucket) = findBoundaryBucketForAmountDisputed(m_AmountDisputed);

    uint128 contributorFeeNumerator = m_feeNumeratorPerContributor[contributor];
    uint128 originalContributionOfContributor = m_contributionPerContributor[contributor];

    if (originalContributionOfContributor == 0) {
      return (0, 0);
    }

    if (contributorFeeNumerator < boundaryFeeNumerator) {
      // this contributor didn't make it into dispute round, just refund REP
      rep = originalContributionOfContributor;
      disputeTokens = 0;
    } else if (contributorFeeNumerator > boundaryFeeNumerator) {
      // this contributor fully got into dispute round, award dispute tokens
      // while subtracting fee
      rep = 0;
      disputeTokens = safeMulDivExact(originalContributionOfContributor, safeSub(FEE_DENOMINATOR, contributorFeeNumerator), FEE_DENOMINATOR);
    } else {
      assert(contributorFeeNumerator == boundaryFeeNumerator);
      // most complex case, contributor partially got into dispute rounds
      uint128 totalBucketSize = m_contributionPerFeeNumerator[contributorFeeNumerator];
      uint128 filledBucketSize = fundsUsedFromBoundaryBucket;
      assert(totalBucketSize > 0);
      assert(filledBucketSize <= totalBucketSize);

      // award dispute tokens proportionally, less fee
      disputeTokens = safeMulDiv(
        safeMulDivExact(
          originalContributionOfContributor,
          safeSub(FEE_DENOMINATOR, contributorFeeNumerator),
          FEE_DENOMINATOR
        ),
        filledBucketSize,
        totalBucketSize
      );
      // refund rep for the rest
      rep = safeMulDiv(
        originalContributionOfContributor,
        safeSub(totalBucketSize, filledBucketSize),
        totalBucketSize
      );
    }
  }

  /**
   * Calculate fee that will be split between contract admin and
   * account that triggered dispute transaction.
   *
   * In case of partial fill, we round down, leaving some dust in the contract.
   */
  function calculateFees() external afterFinalizationOnly view returns (uint128) {
    uint128 boundaryFeeNumerator;
    uint128 fundsUsedFromBoundaryBucket;

    (boundaryFeeNumerator, fundsUsedFromBoundaryBucket) = findBoundaryBucketForAmountDisputed(m_AmountDisputed);

    uint128 totalFees = safeMulDiv(
      fundsUsedFromBoundaryBucket,
      boundaryFeeNumerator,
      FEE_DENOMINATOR
    );

    uint128 feeNumerator = boundaryFeeNumerator + 1;

    while (feeNumerator < FEE_DENOMINATOR) {
      totalFees += safeMulDiv(
        m_contributionPerFeeNumerator[feeNumerator],
        feeNumerator,
        FEE_DENOMINATOR
      );
      feeNumerator += 1;
    }

    return totalFees;
  }
}
