pragma solidity ^0.4.24;

import "./IAccounting.sol";

/**
 * Keeps track of all contributions, and calculates how much each contributor
 * is entitled to.
 *
 * Doesn't actually hold any funds, just keeps records.
 */
contract Accounting is IAccounting {
  uint128 constant public TREE_DEPTH_EDGES = 3;
  uint128 constant public TREE_SPLIT_WIDTH = 10;
  uint128 constant public FEE_DENOMINATOR = TREE_SPLIT_WIDTH ** TREE_DEPTH_EDGES;
  address public m_owner;

  struct ContributionTreeNode {
    uint128 usableFunds;
    uint128 fee;
  }

  // tree is stored flattened in array, 1 element is root node, then
  // TREE_SPLIT_WIDTH nodes are first layer, then TREE_SPLIT_WIDTH**2 edges
  // are second layer and so on.
  // root node represents total contribution, whereas
  // last layer represents contribution for each individual fee numerator.
  // This is used as array, but Solidity has trouble calculating size
  // statically, so mapping will do
  mapping(uint128 => ContributionTreeNode) public m_contributionTree;

  // TODO: merge the following two into a struct
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

  function totalNodesOnTopNLevels(uint128 n) internal pure returns (uint128) {
    if (n == 0) {
      return 0;
    }
    assert(n <= TREE_DEPTH_EDGES);
    return (TREE_SPLIT_WIDTH ** n - 1) / (TREE_SPLIT_WIDTH - 1);
  }

  function getFirstLeafIndex() internal pure returns (uint128) {
    return totalNodesOnTopNLevels(TREE_DEPTH_EDGES);
  }

  function nodeParent(uint128 node) internal pure returns (uint128) {
    assert(node > 0);
    return (node - 1) / TREE_SPLIT_WIDTH;
  }

  function nodeFirstChild(uint128 node) internal pure returns (uint128) {
    return safeAdd(safeMul(node, TREE_SPLIT_WIDTH), 1);
  }

  function nodeLastChild(uint128 node) internal pure returns (uint128) {
    return safeAdd(safeMul(node, TREE_SPLIT_WIDTH), TREE_SPLIT_WIDTH);
  }

  function nodeIsFirstChild(uint128 node) internal pure returns (bool) {
    assert(node > 0);
    return (node - 1) % TREE_SPLIT_WIDTH == 0;
  }

  function nodeIsLastChild(uint128 node) internal pure returns (bool) {
    assert(node > 0);
    return node % TREE_SPLIT_WIDTH == 0;
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

    depositedLessFees = safeMulDivExact(
      amount,
      safeSub(FEE_DENOMINATOR, feeNumerator),
      FEE_DENOMINATOR
    );
    depositedFees = safeMulDivExact(amount, feeNumerator, FEE_DENOMINATOR);

    uint128 nodeIndex = safeAdd(getFirstLeafIndex(), feeNumerator);
    // length of the loop is TREE_DEPTH_EDGES
    while (true) {
      ContributionTreeNode memory node = m_contributionTree[nodeIndex];
      node.usableFunds = safeAdd(node.usableFunds, depositedLessFees);
      node.fee = safeAdd(node.fee, depositedFees);
      m_contributionTree[nodeIndex] = node;
      if (nodeIndex == 0) {
        break;
      }
      nodeIndex = nodeParent(nodeIndex);
    }
  }

  function getContributedForFeeNumerator(
    uint128 feeNumerator
  ) external view returns (uint128) {
    ContributionTreeNode memory node = m_contributionTree[
      getFirstLeafIndex() + feeNumerator
    ];
    return node.usableFunds + node.fee;
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

    withdrawnLessFees = safeMulDivExact(
      amount,
      safeSub(FEE_DENOMINATOR, feeNumerator),
      FEE_DENOMINATOR
    );
    withdrawnFees = safeMulDivExact(amount, feeNumerator, FEE_DENOMINATOR);

    uint128 nodeIndex = getFirstLeafIndex() + feeNumerator;
    // length of the loop is TREE_DEPTH_EDGES
    while (true) {
      ContributionTreeNode memory node = m_contributionTree[nodeIndex];
      node.usableFunds = safeSub(node.usableFunds, withdrawnLessFees);
      node.fee = safeSub(node.fee, withdrawnFees);
      m_contributionTree[nodeIndex] = node;
      if (nodeIndex == 0) {
        break;
      }
      nodeIndex = nodeParent(nodeIndex);
    }
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
    uint128 tentativeBoundaryBucketNode = 0; // start from root node
    uint128 usableFundsInCurrentBucket;
    uint128 usableFundsWithCurrentBucket;
    uint128 usableFundsInBucketsWithHigherFee = 0;

    // length of the loop is TREE_DEPTH_EDGES * TREE_SPLIT_WIDTH
    // we descend the tree from root node, at each step moving one step left or
    // into last child
    while (true) {
      usableFundsInCurrentBucket = m_contributionTree[
        tentativeBoundaryBucketNode
      ].usableFunds;
      usableFundsWithCurrentBucket = safeAdd(
        usableFundsInBucketsWithHigherFee,
        usableFundsInCurrentBucket
      );

      if (
        usableFundsWithCurrentBucket <= amountDisputed &&
        tentativeBoundaryBucketNode != 0 &&
        !nodeIsFirstChild(tentativeBoundaryBucketNode)
      ) {
        // This subtree has fully dusputed, proceed to sibling with lower fee.
        tentativeBoundaryBucketNode = safeSub(tentativeBoundaryBucketNode, 1);
        usableFundsInBucketsWithHigherFee = usableFundsWithCurrentBucket;
      } else {
        // This subtree has NOT fully disputed, or it has no siblings
        // with lower fee.
        if (tentativeBoundaryBucketNode >= getFirstLeafIndex()) {
          // we descended into a leaf
          break;
        } else {
          // Descend into last child
          tentativeBoundaryBucketNode = nodeLastChild(tentativeBoundaryBucketNode);
        }
      }
    }

    // this is needed to protect against corner cases if someone sent dispute
    // tokens into this contract directly in excess from what contributors funded
    uint128 cappedAmountDisputed = amountDisputed <= usableFundsWithCurrentBucket
      ? amountDisputed
      : usableFundsWithCurrentBucket;

    assert(cappedAmountDisputed >= usableFundsInBucketsWithHigherFee);

    feeNumerator = safeSub(tentativeBoundaryBucketNode, getFirstLeafIndex());
    fundsUsedFromBoundaryBucket = safeSub(
      cappedAmountDisputed,
      usableFundsInBucketsWithHigherFee
    );
    assert(fundsUsedFromBoundaryBucket <= usableFundsInCurrentBucket);
  }

  function safeAdd(uint128 a, uint128 b) internal pure returns (uint128) {
    uint128 r = a + b;
    assert(r >= a && r >= b);
    return r;
  }

  function safeSub(uint128 a, uint128 b) internal pure returns (uint128) {
    assert(a >= b);
    return a - b;
  }

  function safeMul(uint128 a, uint128 b) internal pure returns (uint128) {
    uint256 wa = a;
    uint256 wb = b;

    uint256 result = wa * wb;
    uint128 result128 = uint128(result);

    assert(result == result128);
    return result128;
  }

  function safeMulDiv(uint128 a, uint128 b, uint128 c) internal pure returns (uint128) {
    assert(c > 0);
    uint256 wa = a;
    uint256 wb = b;
    uint256 wc = c;

    uint256 result = wa * wb / wc;
    uint128 result128 = uint128(result);

    assert(result == result128);
    return result128;
  }

  function safeMulDivExact(uint128 a, uint128 b, uint128 c) internal pure returns (uint128) {
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
      uint128 usableFundsContributedInBucket = m_contributionTree[
        safeAdd(getFirstLeafIndex(), contributorFeeNumerator)
      ].usableFunds;
      // assertion gotta be true because contributor admittedly did some
      // contribution
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
    uint128 feesFromBoundaryBucket = safeMulDiv(
      m_fundsUsedFromBoundaryBucket,
      m_boundaryFeeNumerator,
      safeSub(FEE_DENOMINATOR, m_boundaryFeeNumerator)
    );

    uint128 totalFees = feesFromBoundaryBucket;
    uint128 previouslyProcessedNode = getFirstLeafIndex() + m_boundaryFeeNumerator;

    // iterate over buckets that have fully participated
    // length of the loop is TREE_DEPTH_EDGES * TREE_SPLIT_WIDTH
    while (previouslyProcessedNode != 0) {
      if (nodeIsLastChild(previouslyProcessedNode)) {
        // we processed all children of some parent
        // in other words, we processed the whole subtree of that parent, go up
        previouslyProcessedNode = nodeParent(previouslyProcessedNode);
      } else {
        // we can collect fee from child with slightly higher fee
        uint128 nodeIndex = safeAdd(previouslyProcessedNode, 1);
        totalFees = safeAdd(
          totalFees,
          m_contributionTree[nodeIndex].fee
        );
        previouslyProcessedNode = nodeIndex;
      }
    }

    return totalFees;
  }
}
