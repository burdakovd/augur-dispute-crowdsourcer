pragma solidity ^0.4.24;

contract Root {
  address public m_owner;

  constructor(address owner) public {
    m_owner = owner;
  }  
}
