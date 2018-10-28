pragma solidity ^0.4.24;

import "./IAccounting.sol";
import "./IAccountingFactory.sol";
import "./ICrowdsourcer.sol";
import "./IDisputer.sol";
import "./IDisputerFactory.sol";

// TODO: add events (global stream)
contract Crowdsourcer is ICrowdsourcer {
  IAccounting public m_accounting;
  ICrowdsourcerParent public m_parent;
  IDisputer public m_disputer;

  mapping(address => bool) m_proceedsCollected;
  bool m_feesCollected = false;

  constructor(
    ICrowdsourcerParent parent,
    IAccountingFactory accountingFactory,
    IDisputerFactory disputerFactory
  ) public {
    m_parent = parent;
    m_accounting = accountingFactory.create(this);
    m_disputer = disputerFactory.create(this);
  }

  modifier beforeDisputeOnly() {
    require (!hasDisputed(), "Method only allowed before dispute");
    _;
  }

  modifier requiresFinalization() {
    if (!isFinalized()) {
      finalize();
      assert(isFinalized());
    }
    _;
  }

  function getParent() external view returns (ICrowdsourcerParent) {
    return m_parent;
  }

  function getDisputer() external view returns (IDisputer) {
    return m_disputer;
  }

  function getAccounting() external view returns (IAccounting) {
    return m_accounting;
  }

  function getREP() public view returns (IERC20) {
    return m_disputer.getREP();
  }

  function getDisputeToken() public view returns (IERC20) {
    return m_disputer.getDisputeTokenAddress();
  }

  function contribute(
    uint128 amount,
    uint128 feeNumerator
  ) external beforeDisputeOnly {
    IERC20 rep = getREP();
    require(rep.balanceOf(msg.sender) >= amount, "Not enough funds");
    require(rep.allowance(msg.sender, this) >= amount, "Now enough allowance");

    // actually transfer tokens and revert tx if any problem
    assert(rep.transferFrom(msg.sender, m_disputer, amount));

    // record contribution in accounting (will perform validations)
    m_accounting.contribute(msg.sender, amount, feeNumerator);
  }

  function withdrawContribution() external beforeDisputeOnly {
    IERC20 rep = getREP();

    // record withdrawal in accounting (will perform validations)
    uint128 withdrawn = m_accounting.withdrawContribution(msg.sender);

    // actually transfer tokens and revert tx if any problem
    assert(rep.transferFrom(m_disputer, msg.sender, withdrawn));
  }

  function hasDisputed() public view returns (bool) {
    return m_disputer.hasDisputed();
  }

  function finalize() public {
    require(hasDisputed(), "Can only finalize after dispute");
    require(!isFinalized(), "Can only finalize once");

    // now that we've disputed we must know dispute token address
    IERC20 disputeTokenAddress = getDisputeToken();
    IERC20 rep = getREP();

    m_disputer.approveManagerToSpendDisputeTokens();

    // retrieve all tokens from disputer for proceeds distribution
    // This wouldn't work extremely well if it is called from disputer's
    // dispute() method, but it should only call Augur which we trust.
    assert(rep.transferFrom(m_disputer, this, rep.balanceOf(m_disputer)));
    assert(
      disputeTokenAddress.transferFrom(
        m_disputer,
        this,
        disputeTokenAddress.balanceOf(m_disputer)
      )
    );

    uint256 amountDisputed = disputeTokenAddress.balanceOf(this);
    uint128 amountDisputed128 = uint128(amountDisputed);

    // REP has only so many tokens
    assert(amountDisputed128 == amountDisputed);

    m_accounting.finalize(amountDisputed128);

    assert(isFinalized());
  }

  function isFinalized() public view returns (bool) {
    return m_accounting.isFinalized();
  }

  function withdrawProceeds(address contributor) external requiresFinalization {
    require(!m_proceedsCollected[contributor], "Can only collect proceeds once");

    // record proceeds have been collected
    m_proceedsCollected[contributor] = true;

    uint128 refund;
    uint128 proceeds;

    // calculate how much this contributor is entitled to
    (refund, proceeds) = m_accounting.calculateProceeds(contributor);

    IERC20 rep = getREP();
    IERC20 disputeTokenAddress = getDisputeToken();

    // actually deliver the proceeds/refund
    assert(rep.transferFrom(this, contributor, refund));
    assert(disputeTokenAddress.transferFrom(this, contributor, proceeds));
  }

  function withdrawFees() external requiresFinalization {
    require(!m_feesCollected, "Can only collect fees once");

    m_feesCollected = true;

    uint128 feesTotal = m_accounting.calculateFees();
    // 10% fees go to contract author
    uint128 feesForContractAuthor = feesTotal / 10;
    uint128 feesForExecutor = feesTotal - feesForContractAuthor;

    assert(feesForContractAuthor + feesForExecutor == feesTotal);

    address contractFeesRecipient = m_parent.getContractFeeReceiver();
    address executorFeesRecipient = m_disputer.feeReceiver();

    IERC20 disputeTokenAddress = getDisputeToken();

    assert(
      disputeTokenAddress.transferFrom(this, contractFeesRecipient, feesForContractAuthor)
    );
    assert(
      disputeTokenAddress.transferFrom(this, executorFeesRecipient, feesForExecutor)
    );
  }
}