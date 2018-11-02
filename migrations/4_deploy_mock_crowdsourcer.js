const AccountingFactory = artifacts.require("AccountingFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const MockCrowdsourcerFactory = artifacts.require("MockCrowdsourcerFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    const accountingFactoryDeployed = await AccountingFactory.deployed();
    const mockDisputerFactoryDeployed = await MockDisputerFactory.deployed();

    await deployer.deploy(
      MockCrowdsourcerFactory,
      accountingFactoryDeployed.address,
      mockDisputerFactoryDeployed.address,
      accounts[0]
    );
  });
};
