pragma solidity ^0.4.24;

import "./IAccounting.sol";
import "./IAccountingFactory.sol";
import "./ICrowdsourcer.sol";
import "./IDisputer.sol";
import "./IDisputerFactory.sol";
import "./DisputerParams.sol";

contract Crowdsourcer is ICrowdsourcer {
  bool public m_isInitialized = false;
  DisputerParams.Params public m_disputerParams;
  IAccountingFactory public m_accountingFactory;
  IDisputerFactory public m_disputerFactory;

  IAccounting public m_accounting;
  ICrowdsourcerParent public m_parent;
  IDisputer public m_disputer;

  mapping(address => bool) public m_proceedsCollected;
  bool public m_feesCollected = false;

  constructor(
    ICrowdsourcerParent parent,
    IAccountingFactory accountingFactory,
    IDisputerFactory disputerFactory,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public {
    m_parent = parent;
    m_accountingFactory = accountingFactory;
    m_disputerFactory = disputerFactory;
    m_disputerParams = DisputerParams.Params(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
  }

  modifier beforeDisputeOnly() {
    require (!hasDisputed(), "Method only allowed before dispute");
    _;
  }

  modifier requiresInitialization() {
    require(isInitialized(), "Must call initialize() first");
    _;
  }

  modifier requiresFinalization() {
    if (!isFinalized()) {
      finalize();
      assert(isFinalized());
    }
    _;
  }

  function isInitialized() public view returns (bool) {
    return m_isInitialized;
  }

  function initialize() external {
    require(!m_isInitialized, "Already initialized");
    m_isInitialized = true;
    m_accounting = m_accountingFactory.create(this);
    m_disputer = m_disputerFactory.create(
      this,
      m_disputerParams.market,
      m_disputerParams.feeWindowId,
      m_disputerParams.payoutNumerators,
      m_disputerParams.invalid
    );
  }

  function getParent() external view returns (ICrowdsourcerParent) {
    return m_parent;
  }

  function getDisputer() external view requiresInitialization returns (IDisputer) {
    return m_disputer;
  }

  function getAccounting() external view requiresInitialization returns (IAccounting) {
    return m_accounting;
  }

  function getREP() public view requiresInitialization returns (IERC20) {
    return m_disputer.getREP();
  }

  function getDisputeToken() public view requiresInitialization returns (IERC20) {
    return m_disputer.getDisputeTokenAddress();
  }

  function contribute(
    uint128 amount,
    uint128 feeNumerator
  ) external requiresInitialization beforeDisputeOnly {
    IERC20 rep = getREP();
    require(rep.balanceOf(msg.sender) >= amount, "Not enough funds");
    require(rep.allowance(msg.sender, this) >= amount, "Now enough allowance");

    // record contribution in accounting (will perform validations)
    uint128 depositedLessFees;
    uint128 depositedFees;
    (depositedLessFees, depositedFees) = m_accounting.contribute(
      msg.sender,
      amount,
      feeNumerator
    );

    assert(depositedLessFees + depositedFees == amount);

    // actually transfer tokens and revert tx if any problem
    assert(rep.transferFrom(msg.sender, m_disputer, depositedLessFees));
    assert(rep.transferFrom(msg.sender, this, depositedFees));

    emit ContributionAccepted(
      msg.sender,
      amount,
      feeNumerator
    );
  }

  function withdrawContribution() external requiresInitialization beforeDisputeOnly {
    IERC20 rep = getREP();

    // record withdrawal in accounting (will perform validations)
    uint128 withdrawnLessFees;
    uint128 withdrawnFees;
    (withdrawnLessFees, withdrawnFees) = m_accounting.withdrawContribution(
      msg.sender
    );

    // actually transfer tokens and revert tx if any problem
    assert(rep.transferFrom(m_disputer, msg.sender, withdrawnLessFees));
    assert(rep.transfer(msg.sender, withdrawnFees));

    emit ContributionWithdrawn(
      msg.sender,
      withdrawnLessFees + withdrawnFees
    );
  }

  function hasDisputed() public view requiresInitialization returns (bool) {
    return m_disputer.hasDisputed();
  }

  function finalize() public requiresInitialization {
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

    emit CrowdsourcerFinalized(amountDisputed128);
  }

  function isFinalized() public view requiresInitialization returns (bool) {
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
    assert(rep.transfer(contributor, refund));
    assert(disputeTokenAddress.transfer(contributor, proceeds));

    emit ProceedsWithdrawn(contributor, proceeds, refund);
  }

  function withdrawFees() external requiresFinalization {
    require(!m_feesCollected, "Can only collect fees once");

    m_feesCollected = true;

    uint128 feesTotal = m_accounting.calculateFees();
    // 10% of fees go to contract author
    uint128 feesForContractAuthor = feesTotal / 10;
    uint128 feesForExecutor = feesTotal - feesForContractAuthor;

    assert(feesForContractAuthor + feesForExecutor == feesTotal);

    address contractFeesRecipient = m_parent.getContractFeeReceiver();
    address executorFeesRecipient = m_disputer.feeReceiver();

    IERC20 rep = getREP();

    assert(rep.transfer(contractFeesRecipient, feesForContractAuthor));
    assert(rep.transfer(executorFeesRecipient, feesForExecutor));

    emit FeesWithdrawn(
      contractFeesRecipient,
      executorFeesRecipient,
      feesForContractAuthor,
      feesForExecutor
    );
  }
}
