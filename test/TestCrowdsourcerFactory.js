import expect from "expect";

const ICrowdsourcer = artifacts.require("ICrowdsourcer");
const Crowdsourcer = artifacts.require("Crowdsourcer");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const AccountingFactory = artifacts.require("AccountingFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");

contract("CrowdsourcerFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];

  it("can deploy", async () => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 0, 0);
    await CrowdsourcerFactory.new(
      accountingFactory.address,
      disputerFactory.address,
      Bob
    );
  });

  const create_test_factory = async () => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 11000000, 0);
    await disputerFactory.prepareMocks();
    return await CrowdsourcerFactory.new(
      accountingFactory.address,
      disputerFactory.address,
      Bob
    );
  };

  it("knows fee collector", async () => {
    const factory = await create_test_factory();
    await expect(factory.getContractFeeReceiver()).resolves.toBe(Bob);
  });

  it("can transfer fee collector", async () => {
    const factory = await create_test_factory();
    await expect(factory.getContractFeeReceiver()).resolves.toBe(Bob);
    await factory.transferFeeCollection(Alice, { from: Bob });
    await expect(factory.getContractFeeReceiver()).resolves.toBe(Alice);
  });

  it("cannot steal fee collection", async () => {
    const factory = await create_test_factory();
    await expect(factory.getContractFeeReceiver()).resolves.toBe(Bob);
    await expect(
      factory.transferFeeCollection(Alice, { from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("responds with 0 when trying to get unknown crowdsourcer", async () => {
    const factory = await create_test_factory();
    await expect(
      factory.maybeGetCrowdsourcer(Alice, 0, [], false)
    ).resolves.toBe("0x0000000000000000000000000000000000000000");
  });

  it("can create crowdsourcer - view", async () => {
    const factory = await create_test_factory();
    await expect(
      factory.getCrowdsourcer.call(Alice, 0, [], false)
    ).resolves.not.toBe("0x0000000000000000000000000000000000000000");
  });

  it("can create crowdsourcer - and then get it", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [], false);
    await expect(
      factory.maybeGetCrowdsourcer(Alice, 0, [], false)
    ).resolves.not.toBe("0x0000000000000000000000000000000000000000");
    await expect(
      factory.maybeGetCrowdsourcer(Alice, 0, [], true)
    ).resolves.toBe("0x0000000000000000000000000000000000000000");
  });

  it("new crowdsources are created uninitialized", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [], false);
    const crowdsourcer = await factory.maybeGetCrowdsourcer(
      Alice,
      0,
      [],
      false
    );
    await expect(ICrowdsourcer.at(crowdsourcer).isInitialized()).resolves.toBe(
      false
    );
  });

  it("can create more than one crowdsourcer", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [], false);
    await factory.getCrowdsourcer(Alice, 4, [], false);
    const crowdsourcer1 = await factory.maybeGetCrowdsourcer(
      Alice,
      0,
      [],
      false
    );
    const crowdsourcer2 = await factory.maybeGetCrowdsourcer(
      Alice,
      4,
      [],
      false
    );
    expect(crowdsourcer1).not.toBe(
      "0x0000000000000000000000000000000000000000"
    );
    expect(crowdsourcer2).not.toBe(
      "0x0000000000000000000000000000000000000000"
    );
    expect(crowdsourcer1).not.toBe(crowdsourcer2);
  });

  it("passes parent correctly", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [], false);
    const crowdsourcer = await factory.maybeGetCrowdsourcer(
      Alice,
      0,
      [],
      false
    );
    await expect(ICrowdsourcer.at(crowdsourcer).getParent()).resolves.toBe(
      factory.address
    );
  });

  it("passes disputer params correctly", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 566, [1, 4, 5], true);
    const crowdsourcer = await factory.maybeGetCrowdsourcer(
      Alice,
      566,
      [1, 4, 5],
      true
    );
    await expect(
      Crowdsourcer.at(crowdsourcer)
        .m_disputerParams()
        .then(a => a.map(e => e.toString()))
    ).resolves.toEqual([
      "0xf17f52151ebef6c7334fad080c5704d77216b732",
      "566",
      // somehow Truffle loses array here :(
      "true"
    ]);
  });

  it("can initialize it after creation", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [4, 7], false);
    const crowdsourcer = await factory.maybeGetCrowdsourcer(
      Alice,
      0,
      [4, 7],
      false
    );
    await expect(ICrowdsourcer.at(crowdsourcer).isInitialized()).resolves.toBe(
      false
    );
    await ICrowdsourcer.at(crowdsourcer).initialize();
    await expect(ICrowdsourcer.at(crowdsourcer).isInitialized()).resolves.toBe(
      true
    );
  });

  it("can create and initialize crowdsourcer when it exists", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 0, [], false);
  });

  it("can create and initialize crowdsourcer - out of gas", async () => {
    const factory = await create_test_factory();
    await expect(
      factory.getInitializedCrowdsourcer(Alice, 0, [], false)
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("cost of creating simple crowdsourcer", async () => {
    const factory = await create_test_factory();
    const receipt = await factory.getCrowdsourcer(Alice, 0, [5000, 5000], true);
    expect(receipt.receipt.gasUsed).toBe(3070414);
  });

  it("cost of creating bigger crowdsourcer", async () => {
    const factory = await create_test_factory();
    const receipt = await factory.getCrowdsourcer(
      Alice,
      4,
      [1, 2, 3, 4, 5, 6, 7, 8],
      false
    );
    expect(receipt.receipt.gasUsed).toBe(3195469);
  });

  it("cost of initializing crowdsourcer", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 0, [5000, 5000], true);
    const receipt = await factory.getInitializedCrowdsourcer(
      Alice,
      0,
      [5000, 5000],
      true
    );
    expect(receipt.receipt.gasUsed).toBe(4184546);
  });
});
