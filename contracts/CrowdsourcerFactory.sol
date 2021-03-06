pragma solidity 0.4.24;

import "./IAccountingFactory.sol";
import "./IDisputerFactory.sol";
import "./ICrowdsourcerParent.sol";
import "./ICrowdsourcer.sol";
import "./Crowdsourcer.sol";
import "./DisputerParams.sol";

/**
 * NOTE: the created crowdsourcers trust the market that was passed in constructor.
 * If a malicious market is passed in, all bets are off.
 *
 * Individual crowdsourcers have no trust relationships with each other.
 */
contract CrowdsourcerFactory is ICrowdsourcerParent {
  event CrowdsourcerCreated(
    ICrowdsourcer crowdsourcer,
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  );

  IAccountingFactory public m_accountingFactory;
  IDisputerFactory public m_disputerFactory;

  address public m_feeCollector;
  mapping(bytes32 => ICrowdsourcer) public m_crowdsourcers;
  mapping(uint256 => ICrowdsourcer[]) private m_crowdsourcersPerFeeWindow;

  constructor(
    IAccountingFactory accountingFactory,
    IDisputerFactory disputerFactory,
    address feeCollector
  ) public {
    m_accountingFactory = accountingFactory;
    m_disputerFactory = disputerFactory;
    m_feeCollector = feeCollector;
  }

  function transferFeeCollection(address recipient) external {
    require(msg.sender == m_feeCollector, "Not authorized");
    m_feeCollector = recipient;
  }

  function getInitializedCrowdsourcer(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external returns(ICrowdsourcer) {
    ICrowdsourcer crowdsourcer = getCrowdsourcer(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    if (!crowdsourcer.isInitialized()) {
      crowdsourcer.initialize();
      assert(crowdsourcer.isInitialized());
    }
    return crowdsourcer;
  }

  function getContractFeeReceiver() external view returns(address) {
    return m_feeCollector;
  }

  function maybeGetCrowdsourcer(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external view returns(ICrowdsourcer) {
    bytes32 paramsHash = hashParams(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    return m_crowdsourcers[paramsHash];
  }

  function getCrowdsourcer(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public returns(ICrowdsourcer) {
    bytes32 paramsHash = hashParams(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    ICrowdsourcer existing = m_crowdsourcers[paramsHash];
    if (address(existing) != 0) {
      return existing;
    }
    ICrowdsourcer created = new Crowdsourcer(
      this,
      m_accountingFactory,
      m_disputerFactory,
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    emit CrowdsourcerCreated(
      created,
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    m_crowdsourcersPerFeeWindow[feeWindowId].push(created);
    m_crowdsourcers[paramsHash] = created;
    return created;
  }

  function findCrowdsourcer(
    uint256 feeWindowId,
    uint256 startFrom,
    uint256 minFeesOffered,
    ICrowdsourcer[] exclude
  ) public view returns(uint256, ICrowdsourcer) {
    ICrowdsourcer[] storage crowdsourcers = m_crowdsourcersPerFeeWindow[feeWindowId];
    uint256 n = crowdsourcers.length;
    uint256 i;

    for (i = startFrom; i < n; ++i) {
      ICrowdsourcer candidate = crowdsourcers[i];

      if (!candidate.isInitialized() || candidate.getAccounting(

      ).getTotalFeesOffered() < minFeesOffered) {
        continue;
      }

      bool isGood = true;
      for (uint256 j = 0; j < exclude.length; ++j) {
        if (candidate == exclude[j]) {
          isGood = false;
          break;
        }
      }

      if (isGood) {
        return (i, candidate);
      }
    }

    return (i, ICrowdsourcer(0));
  }

  function getNumCrowdsourcers(uint256 feeWindowId) public view returns(
    uint256
  ) {
    return m_crowdsourcersPerFeeWindow[feeWindowId].length;
  }

  function hashParams(
    Market market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public pure returns(bytes32) {
    return keccak256(
      abi.encodePacked(market, feeWindowId, payoutNumerators, invalid)
    );
  }
}
