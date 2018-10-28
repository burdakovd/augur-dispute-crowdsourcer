import expect from "expect";

const AccountingFactory = artifacts.require("AccountingFactory");
const Crowdsourcer = artifacts.require("Crowdsourcer");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");
const MockCrowdsourcerParent = artifacts.require("MockCrowdsourcerParent");

contract("Crowdsourcer", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];

  it("can deploy", async () => {
    const mockCrowdsourcerParent = await MockCrowdsourcerParent.new(Manager);
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    await disputerFactory.prepareMocks();
    await Crowdsourcer.new(
      mockCrowdsourcerParent.address,
      accountingFactory.address,
      disputerFactory.address
    );
  });

  it("knows parent", async () => {
    const mockCrowdsourcerParent = await MockCrowdsourcerParent.new(Manager);
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    await disputerFactory.prepareMocks();
    const instance = await Crowdsourcer.new(
      mockCrowdsourcerParent.address,
      accountingFactory.address,
      disputerFactory.address
    );
    const parent = await instance.getParent();
    expect(parent).toEqual(mockCrowdsourcerParent.address);
  });

  // TODO: more tests
});
