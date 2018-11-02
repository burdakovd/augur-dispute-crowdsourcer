const AccountingFactory = artifacts.require("AccountingFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const MockCrowdsourcerFactory = artifacts.require("MockCrowdsourcerFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    // deploy accounting; this contract is pure so no mock versions needed
    await deployer.deploy(AccountingFactory);
  });
};
