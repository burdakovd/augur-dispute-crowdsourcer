pragma solidity 0.4.24;

contract Notary {
  event Hacked(uint256 timestamp);

  address public m_owner;
  uint256 public m_hackedTimestamp;

  constructor() public {
    m_owner = msg.sender;
    m_hackedTimestamp = 0;
  }

  modifier restricted() {
    require(msg.sender == m_owner, "Unauthorized");
    _;
  }

  function reportHacked() external restricted {
    require(m_hackedTimestamp == 0);
    // solhint-disable-next-line not-rely-on-time
    assert(block.timestamp != 0);
    // solhint-disable-next-line not-rely-on-time
    m_hackedTimestamp = block.timestamp;
    // solhint-disable-next-line not-rely-on-time
    emit Hacked(block.timestamp);
  }

  function isHacked() external view returns(bool) {
    return m_hackedTimestamp != 0;
  }
}
