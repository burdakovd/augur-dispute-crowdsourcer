pragma solidity ^0.4.24;

import "./IAccountingFactory.sol";
import "./IDisputerFactory.sol";
import "./ICrowdsourcerParent.sol";
import "./ICrowdsourcer.sol";
import "./Crowdsourcer.sol";
import "./DisputerParams.sol";

contract CrowdsourcerFactory is ICrowdsourcerParent {
  event CrowdsourcerCreated (
    ICrowdsourcer crowdsourcer,
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  );

  IAccountingFactory public m_accountingFactory;
  IDisputerFactory public m_disputerFactory;

  address public m_feeCollector;
  mapping(bytes32 => ICrowdsourcer) public m_crowdsourcers;

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

  function getContractFeeReceiver() external view returns (address) {
    return m_feeCollector;
  }

  function hashParams(
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public pure returns (bytes32) {
    return keccak256(
      abi.encodePacked(
        market,
        feeWindowId,
        payoutNumerators,
        invalid
      )
    );
  }

  function maybeGetCrowdsourcer(
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external view returns (ICrowdsourcer) {
    bytes32 paramsHash = hashParams(
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    return m_crowdsourcers[paramsHash];
  }

  function getCrowdsourcer(
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) public returns (ICrowdsourcer) {
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
    emit CrowdsourcerCreated (
      created,
      market,
      feeWindowId,
      payoutNumerators,
      invalid
    );
    m_crowdsourcers[paramsHash] = created;
    return created;
  }

  function getInitializedCrowdsourcer(
    address market,
    uint256 feeWindowId,
    uint256[] payoutNumerators,
    bool invalid
  ) external returns (ICrowdsourcer) {
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
}
