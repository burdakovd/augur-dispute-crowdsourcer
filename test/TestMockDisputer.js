import expect from "expect";
import invariant from "invariant";

/**
 * We can't rest real disputer easily as it requires deploying all Augur
 * contracts, so we test mock version of it. This version inherits most of the
 * same code via BaseDisputer, and overrides just a little bit.
 *
 * The code that is only in MockDisputer will not have automated test coverage
 * for now, so will need to be tested on mainnet
 * (or via more sophisticated test suites).
 */

const IDisputer = artifacts.require("IDisputer");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

function onlyx(a) {
  invariant(a.length === 1, `Must have one element, got ${a.length}`);
  return a[0];
}

contract("MockDisputer", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];

  const create_test_disputer = async (
    addressToSendABunchOfREPTo,
    amountOfREP,
    amountOfRepToUseForDispute
  ) => {
    const factory = await MockDisputerFactory.new(Bob, 0, 0);
    await factory.prepareMocks();
    const event = await factory
      .create(Manager)
      .then(receipt => onlyx(receipt.logs).args);
    return IDisputer.at(event._address);
  };

  it("can create instance of disputer", async () => {
    await create_test_disputer();
  });

  it("knows owner", async () => {
    const disputer = await create_test_disputer();
    await expect(disputer.getOwner()).resolves.toEqual(Manager);
  });
});
