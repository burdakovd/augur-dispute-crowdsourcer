const AccountingFactory = artifacts.require("AccountingFactory");
const DisputerFactory = artifacts.require("DisputerFactory");
const Accounting = artifacts.require("Accounting");
const Disputer = artifacts.require("Disputer");
const Crowdsourcer = artifacts.require("Crowdsourcer");

/**
 * These are only used for source code verification.
 */
module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    const accountingFactoryDeployed = await AccountingFactory.deployed();
    const disputerFactoryDeployed = await DisputerFactory.deployed();

    await deployer.deploy(Accounting, 0);
    await deployer.deploy(Disputer, 0, 0, 0, [], false);
    await deployer.deploy(
      Crowdsourcer,
      0,
      accountingFactoryDeployed.address,
      disputerFactoryDeployed.address,
      0,
      0,
      [],
      false
    );
  });
};
