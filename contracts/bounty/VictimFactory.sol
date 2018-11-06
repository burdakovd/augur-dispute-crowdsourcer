pragma solidity 0.4.24;

import "./Faucet.sol";
import "../ICrowdsourcer.sol";
import "../Crowdsourcer.sol";
import "../CrowdsourcerFactory.sol";
import "./Victim.sol";
import "./Notary.sol";

contract VictimFactory {
  event VictimCreated(address hacker, Victim victim);
  event ClaimFailed(address hacker, Victim victim);
  event ClaimSucceeded(address hacker, Victim victim);

  CrowdsourcerFactory public m_factory;
  Universe public m_trustedUniverse;
  Notary public m_notary;
  mapping(address => address) public m_hackers;

  constructor(CrowdsourcerFactory factory, Universe trustedUniverse) public {
    m_trustedUniverse = trustedUniverse;
    m_factory = factory;
    m_notary = new Notary();
  }

  function createVictim(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid,
    uint128 amount,
    uint128 fee
  ) external returns(Victim) {
    // when universe is 0, it is a test case for how bounty handles funds loss
    if (address(m_trustedUniverse) != 0) {
      // do not allow shady markets, that would be too easy
      require(m_trustedUniverse.isContainerForMarket(market));
      require(
        amount != 666000 && amount != 667000,
        "Those amounts are used for testing, do not allow for real bounty"
      );
    }

    Victim victim = new Victim(
      m_factory,
      market,
      feeWindowId,
      payoutNumerators,
      invalid,
      amount,
      fee
    );

    emit VictimCreated(msg.sender, victim);

    m_hackers[victim] = msg.sender;
    return victim;
  }

  function claimHacked(Victim victim) external returns(bool) {
    // gotta have lots of gas for this one, don't want it to fail with
    // out-of-gas somewhere in the middle of validation
    require(gasleft() >= 5900000);
    require(m_hackers[victim] == msg.sender, "It is not yours");
    // allow only claim once per victim
    m_hackers[victim] = 0;

    // hopefully 5M gas will be enough, isValid will be false if validation
    // failed (including case of infinite loop)
    bool isValid = address(victim).call.gas(5000000)(
      bytes4(keccak256("validate()"))
    );

    if (isValid) {
      emit ClaimFailed(msg.sender, victim);
    } else {
      emit ClaimSucceeded(msg.sender, victim);
      m_notary.reportHacked();
    }
  }

  function isHacked() external view returns(bool) {
    return m_notary.isHacked();
  }
}
