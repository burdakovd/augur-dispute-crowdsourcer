const AccountingFactory = artifacts.require("AccountingFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const MockCrowdsourcerFactory = artifacts.require("MockCrowdsourcerFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    await deployer.deploy(MockDisputerFactory, accounts[0], 11000000, 1000);
    const mockDisputerFactoryDeployed = await MockDisputerFactory.deployed();
    await mockDisputerFactoryDeployed.prepareMocks();
  });
};
