const DisputerFactory = artifacts.require("DisputerFactory");

contract("DisputerFactory", accounts => {
  const Alice = accounts[1];
  const Bob = accounts[2];

  it("can deploy", async () => {
    await DisputerFactory.new();
  });

  it("will allow anyone to create instances", async () => {
    const factory = await DisputerFactory.new(Alice, 0, 0);
    const event1 = await factory.create(Bob, 0, 0, [], false);
  });

  // can't really test much of Disputer contracts, since it will
  // require real Augur markets
  // We do extensive tests of mock Disputer contracts, and most code is shared
});
