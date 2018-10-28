import expect from "expect";
import invariant from "invariant";

const IAccounting = artifacts.require("IAccounting");
const AccountingFactory = artifacts.require("AccountingFactory");

function onlyx(a) {
  invariant(a.length === 1, `Must have one element, got ${a.length}`);
  return a[0];
}

// TODO: once we deploy, we may use deployed AccountingFactory rather than
// instantiate it here
contract("AccountingFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];

  it("can deploy", async () => {
    await AccountingFactory.new();
  });

  it("will allow anyone to create instances and forward ownership", async () => {
    const factory = await AccountingFactory.new();

    const event1 = await factory
      .create(Manager)
      .then(receipt => onlyx(receipt.logs).args);
    expect(event1._owner).toBe(Manager);
    expect(IAccounting.at(event1._address).getOwner()).resolves.toEqual(
      Manager
    );

    const event2 = await factory
      .create(Alice)
      .then(receipt => onlyx(receipt.logs).args);
    expect(event2._owner).toBe(Alice);
    expect(IAccounting.at(event2._address).getOwner()).resolves.toEqual(
      Manager
    );
  });
});
