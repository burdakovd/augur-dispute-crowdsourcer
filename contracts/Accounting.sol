pragma solidity ^0.4.24;

import "./IAccounting.sol";

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

  // populated at finalization
  bool public m_isFinalized = false;
  uint128 m_boundaryFeeNumerator;
  uint128 m_fundsUsedFromBoundaryBucket;

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

  function getOwner() external view returns (address) {
    return m_owner;
  }

  function contribute(
    address contributor,
    uint128 amount,
    uint128 feeNumerator
  ) external ownerOnly beforeFinalizationOnly returns (
    uint128 depositedLessFees,
    uint128 depositedFees
  ) {
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
    m_contributionPerFeeNumerator[feeNumerator] = safeAdd(
      m_contributionPerFeeNumerator[feeNumerator],
      amount
    );

    return (
      safeMulDiv(
        amount,
        safeSub(FEE_DENOMINATOR, feeNumerator),
        FEE_DENOMINATOR
      ),
      safeMulDiv(amount, feeNumerator, FEE_DENOMINATOR)
    );
  }

  function withdrawContribution(
    address contributor
  ) external ownerOnly beforeFinalizationOnly returns (
    uint128 withdrawnLessFees,
    uint128 withdrawnFees
  ) {
    uint128 amount = m_contributionPerContributor[contributor];

    m_contributionPerContributor[contributor] = 0;

    uint128 feeNumerator = m_feeNumeratorPerContributor[contributor];
    m_contributionPerFeeNumerator[feeNumerator] = safeSub(
      m_contributionPerFeeNumerator[feeNumerator],
      amount
    );

    return (
      safeMulDiv(
        amount,
        safeSub(FEE_DENOMINATOR, feeNumerator),
        FEE_DENOMINATOR
      ),
      safeMulDiv(amount, feeNumerator, FEE_DENOMINATOR)
    );
  }

  /**
   * Someone may have sent us (by mistake or maliciously) extra dispute tokens.
   * This is not fatal, but we need to be aware that amountDisputed may actually
   * be greater than the REP contributed and not crash.
   */
  function finalize(uint128 amountDisputed) external ownerOnly beforeFinalizationOnly {
    m_isFinalized = true;
    (
      m_boundaryFeeNumerator,
      m_fundsUsedFromBoundaryBucket
    ) = findBoundaryBucketForAmountDisputed(amountDisputed);
  }

  function isFinalized() external view returns (bool) {
    return m_isFinalized;
  }

  /**
   * Finds such lowest fee bucket, that all buckets with fee higher than that
   * were fully included in the dispute. From that will also follow that none
   * of the funds from buckets with fee lower than that were included in the
   * dispute.
   *
   * Also calculates how much funds from the boundary bucket were included in
   * the dispute (normally current bucket participated partially).
   *
   * The returned index will always be a valid feeNumerator.
   */
  function findBoundaryBucketForAmountDisputed(
    uint128 amountDisputed
  ) internal view returns (uint128 feeNumerator, uint128 fundsUsedFromBoundaryBucket) {
    // initialize with one-past-last bucket; loop will do at least one iteration
    uint128 tentativeBoundaryBucket = FEE_DENOMINATOR;
    uint128 usableFundsInCurrentBucket;
    uint128 usableFundsWithCurrentBucket = 0;
    uint128 usableFundsInBucketsWithHigherFee;

    // length of the loop constrained by constant FEE_DENOMINATOR
    assert(tentativeBoundaryBucket > 0 && usableFundsWithCurrentBucket <= amountDisputed);
    while (tentativeBoundaryBucket > 0 && usableFundsWithCurrentBucket <= amountDisputed) {
      tentativeBoundaryBucket -= 1;
      usableFundsInBucketsWithHigherFee = usableFundsWithCurrentBucket;
      uint128 fundsInCurrentBucket = m_contributionPerFeeNumerator[tentativeBoundaryBucket];
      // TODO: consider skipping executions if fundsInCurrentBucket = 0
      // Not skipping now to make it more evident that 1000 iterations of full
      // loop body (worst case) is OK gas-wise. I.e. we make sure that
      // worst-case is triggered frequently enough to not become a surprise.
      usableFundsInCurrentBucket = safeMulDivExact(
        fundsInCurrentBucket,
        safeSub(FEE_DENOMINATOR, tentativeBoundaryBucket),
        FEE_DENOMINATOR
      );
      usableFundsWithCurrentBucket = safeAdd(
        usableFundsInBucketsWithHigherFee,
        usableFundsInCurrentBucket
      );
    }

    // this is needed to protect against corner cases if someone sent dispute
    // tokens into this contract directly in excess from what contributors funded
    uint128 cappedAmountDisputed = amountDisputed <= usableFundsWithCurrentBucket
      ? amountDisputed
      : usableFundsWithCurrentBucket;

    assert(cappedAmountDisputed >= usableFundsInBucketsWithHigherFee);

    feeNumerator = tentativeBoundaryBucket;
    fundsUsedFromBoundaryBucket = safeSub(
      cappedAmountDisputed,
      usableFundsInBucketsWithHigherFee
    );
    assert(fundsUsedFromBoundaryBucket <= usableFundsInCurrentBucket);
  }
  
  // TODO: make safemath internal, or s/assert/require/

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
  function calculateProceeds(
    address contributor
  ) external afterFinalizationOnly view returns (uint128 rep, uint128 disputeTokens) {
    uint128 contributorFeeNumerator = m_feeNumeratorPerContributor[contributor];
    uint128 originalContributionOfContributor = m_contributionPerContributor[contributor];

    if (originalContributionOfContributor == 0) {
      return (0, 0);
    }

    if (contributorFeeNumerator < m_boundaryFeeNumerator) {
      // this contributor didn't make it into dispute round, just refund REP
      rep = originalContributionOfContributor;
      disputeTokens = 0;
    } else if (contributorFeeNumerator > m_boundaryFeeNumerator) {
      // this contributor fully got into dispute round, award dispute tokens
      // while subtracting fee
      rep = 0;
      disputeTokens = safeMulDivExact(
        originalContributionOfContributor,
        safeSub(FEE_DENOMINATOR, contributorFeeNumerator),
        FEE_DENOMINATOR
      );
    } else {
      assert(contributorFeeNumerator == m_boundaryFeeNumerator);
      // most complex case, contributor partially got into dispute rounds
      uint128 fundsContributedInBucket = m_contributionPerFeeNumerator[contributorFeeNumerator];
      // assertion gotta be true because contributor admittedly did some
      // contribution
      assert(fundsContributedInBucket > 0);
      uint128 usableFundsContributedInBucket = safeMulDivExact(
        fundsContributedInBucket,
        safeSub(FEE_DENOMINATOR, contributorFeeNumerator),
        FEE_DENOMINATOR
      );
      // assertion gotta be true since contribution must be exactly divisible
      // by fee denominator
      assert(usableFundsContributedInBucket > 0);
      uint128 fundsUsedInBucket = m_fundsUsedFromBoundaryBucket;
      assert(fundsUsedInBucket <= usableFundsContributedInBucket);

      // award dispute tokens proportionally, less fee
      disputeTokens = safeMulDiv(
        safeMulDivExact(
          originalContributionOfContributor,
          safeSub(FEE_DENOMINATOR, contributorFeeNumerator),
          FEE_DENOMINATOR
        ),
        fundsUsedInBucket,
        usableFundsContributedInBucket
      );
      // refund rep for the rest
      rep = safeMulDiv(
        originalContributionOfContributor,
        safeSub(usableFundsContributedInBucket, fundsUsedInBucket),
        usableFundsContributedInBucket
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
    uint128 boundaryFeeNumerator = m_boundaryFeeNumerator;
    uint128 feesFromBoundaryBucket = safeMulDiv(
      m_fundsUsedFromBoundaryBucket,
      boundaryFeeNumerator,
      safeSub(FEE_DENOMINATOR, boundaryFeeNumerator)
    );

    uint128 feeNumerator = boundaryFeeNumerator + 1;
    uint128 totalFees = feesFromBoundaryBucket;
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
