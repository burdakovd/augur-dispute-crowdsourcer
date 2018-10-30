const AccountingFactory = artifacts.require("AccountingFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const MockCrowdsourcerFactory = artifacts.require("MockCrowdsourcerFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    // deploy accounting; this contract is pure so no mock versions needed
    await deployer.deploy(AccountingFactory);

    // deploy mock versions of contracts for testing without Augur
    await deployer.deploy(MockDisputerFactory, accounts[1], 11000000, 1000);
    await MockDisputerFactory.deployed().then(instance =>
      instance.prepareMocks.sendTransaction()
    );
    await deployer.deploy(
      MockCrowdsourcerFactory,
      AccountingFactory.address,
      MockDisputerFactory.address,
      accounts[2]
    );

    // deploy real versions of contracts for actual use with Augur
    await deployer.deploy(DisputerFactory);
    await deployer.deploy(
      CrowdsourcerFactory,
      AccountingFactory.address,
      DisputerFactory.address,
      "0x2404a39e447d0c8b417049fc42b468a26990b4cc"
    );
  });
};
