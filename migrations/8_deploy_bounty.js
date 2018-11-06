const VictimFactory = artifacts.require("VictimFactory");
const BackdooredVictimFactory = artifacts.require("BackdooredVictimFactory");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");

/**
 * These are only used for source code verification.
 */
module.exports = function(deployer, network, accounts) {
  deployer.then(async () => {
    if (network !== "rinkeby") {
      return;
    }
    // https://github.com/AugurProject/augur.js/blob/master/src/contracts/addresses.json#L42
    const RINKEBY_TRUSTED_UNIVERSE =
      "0x02149d40d255fceac54a3ee3899807b0539bad60";

    const crowdsourcerFactoryDeployed = await CrowdsourcerFactory.deployed();

    // deploy backdoored version first
    await deployer.deploy(
      BackdooredVictimFactory,
      crowdsourcerFactoryDeployed.address
    );

    // deploy real one
    await deployer.deploy(
      VictimFactory,
      crowdsourcerFactoryDeployed.address,
      RINKEBY_TRUSTED_UNIVERSE
    );
  });
};
