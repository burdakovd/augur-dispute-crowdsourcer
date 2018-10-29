import expect from "expect";
import invariant from "invariant";

const IDisputer = artifacts.require("IDisputer");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

function onlyx(a) {
  invariant(a.length === 1, `Must have one element, got ${a.length}`);
  return a[0];
}

contract("MockDisputerFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];

  it("can deploy", async () => {
    await MockDisputerFactory.new(Bob, 0, 0);
  });

  it("can deploy and prepare", async () => {
    const factory = await MockDisputerFactory.new(Bob, 0, 0);
    await factory.prepareMocks();
  });

  it("will allow anyone to create instances and forward ownership", async () => {
    const factory = await MockDisputerFactory.new(Bob, 0, 0);
    await factory.prepareMocks();

    const event1 = await factory
      .create(Manager, 0, 0, [], false)
      .then(receipt => onlyx(receipt.logs).args);
    expect(event1._owner).toBe(Manager);
    await expect(IDisputer.at(event1._address).getOwner()).resolves.toEqual(
      Manager
    );

    const event2 = await factory
      .create(Alice, 0, 0, [], false)
      .then(receipt => onlyx(receipt.logs).args);
    expect(event2._owner).toBe(Alice);
    await expect(IDisputer.at(event2._address).getOwner()).resolves.toEqual(
      Alice
    );
  });
});
