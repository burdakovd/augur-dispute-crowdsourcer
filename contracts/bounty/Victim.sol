pragma solidity 0.4.24;

import "./Faucet.sol";
import "../ICrowdsourcer.sol";
import "../Crowdsourcer.sol";
import "../CrowdsourcerFactory.sol";

contract Victim {
  uint128 public m_expectedBalance;
  uint128 public m_fee;
  IERC20 public m_rep;
  ICrowdsourcer public m_crowdsourcer;
  bytes32 public m_payoutDistributionHash;
  Market public m_market;
  uint128 public m_amount;
  bool public m_validated = false;

  event Validated();

  // parent will check quality of market
  // before invoking this constructor
  // so here we trust market
  constructor(
    CrowdsourcerFactory factory,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid,
    uint128 amount,
    uint128 fee
  ) public {
    if (address(factory) == 0) {
      // for source code verification deployment
      return;
    }

    require(fee < 1000);
    require(amount > 0 && amount < 2 ** 90);
    m_fee = fee;

    m_payoutDistributionHash = market.derivePayoutDistributionHash(
      payoutNumerators,
      invalid
    );
    m_market = market;
    m_amount = amount;

    // mint some extra to pay fees
    m_expectedBalance = 2 * amount;
    m_rep = market.getReputationToken();
    Faucet(m_rep).faucet(m_expectedBalance);
    assert(m_rep.balanceOf(this) == m_expectedBalance);

    // place funds into crowdsourcer
    m_crowdsourcer = factory.getInitializedCrowdsourcer(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    m_rep.approve(m_crowdsourcer, 2 ** 128);
    m_crowdsourcer.contribute(amount, fee);

    // special case for testing of funds loss
    if (amount == 666000) {
      // "lose" 100 attorep by sending then to rep itself
      m_rep.transfer(m_rep, 100);
    }
  }

  function validate() external {
    if (m_validated) {
      return;
    }
    m_validated = true;
    validateImpl();
    emit Validated();
  }

  function withdrawWhatWeCanFromCrowdsourcer() internal {
    if (!m_crowdsourcer.hasDisputed()) {
      m_crowdsourcer.withdrawContribution();
    } else if (!Crowdsourcer(m_crowdsourcer).m_proceedsCollected(this)) {
      m_crowdsourcer.withdrawProceeds(this);
    }
  }

  // if this throws, we are in bad state
  // solhint-disable-next-line code-complexity,function-max-lines
  function validateImpl() internal {
    withdrawWhatWeCanFromCrowdsourcer();

    uint256 disputeTokens = 0;
    if (m_crowdsourcer.hasDisputed()) {
      IERC20 disputeToken = m_crowdsourcer.getDisputeToken();
      // check quality of that dispute token
      require(
        ReportingParticipant(disputeToken).getPayoutDistributionHash(

        ) == m_payoutDistributionHash,
        "We got a bad dispute token"
      );
      if (m_market.isContainerForReportingParticipant(
        ReportingParticipant(disputeToken)
      )) {
        // dispute token is still in dispute and is trusted
        disputeTokens = disputeToken.balanceOf(this);
      } else {
        // disavowed or fake dispute token, we don't care
        // as long as we can withdraw REP from it.
        //
        // Augur requires waiting for next week until disavowed dispute tokens
        // can be redeemed.
        // We don't want to slow down bounty that much, so if claim is called
        // before fee window is over, we just consider it acceptable

        // so we just consider this token OK-ish
        // this will not catch fake dispute tokens, but I don't want to make
        // bounty too complex
        disputeTokens = disputeToken.balanceOf(this);
      }
    }

    if (disputeTokens >= m_expectedBalance) {
      // in case someone managed to generate so many dispute tokens that
      // following math will overflow
      //
      // we got more dispute tokens than we had REP, this is good
      return;
    }

    // will not overflow due to constraints on m_fee and m_expectedBalance
    // and check above (+10 is for rounding errors)
    uint256 expectedToPay = disputeTokens * (1000 + m_fee) / 1000 + 10;

    if (expectedToPay >= m_expectedBalance) {
      return;
    }

    m_expectedBalance -= uint128(expectedToPay);

    require(m_rep.balanceOf(this) >= m_expectedBalance, "funds must be SAFU");

    if (m_amount == 667000) {
      // solhint-disable-next-line no-empty-blocks
      while (true) {

      }
    }
  }
}
