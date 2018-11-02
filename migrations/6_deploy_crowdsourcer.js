const AccountingFactory = artifacts.require("AccountingFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const MockCrowdsourcerFactory = artifacts.require("MockCrowdsourcerFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    const accountingFactoryDeployed = await AccountingFactory.deployed();
    const disputerFactoryDeployed = await DisputerFactory.deployed();

    await deployer.deploy(
      CrowdsourcerFactory,
      accountingFactoryDeployed.address,
      disputerFactoryDeployed.address,
      "0x2404a39e447d0c8b417049fc42b468a26990b4cc"
    );
  });
};
