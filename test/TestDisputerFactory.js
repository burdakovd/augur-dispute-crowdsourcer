const DisputerFactory = artifacts.require("DisputerFactory");

contract("DisputerFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];

  it("can deploy", async () => {
    await DisputerFactory.new();
  });

  // can't really test creation of Disputer contracts, since it will
  // require real Augur markets
  // We do test creation of mock Disputer contracts, and most of code is shared
});
