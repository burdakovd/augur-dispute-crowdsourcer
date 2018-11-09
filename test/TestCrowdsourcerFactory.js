import expect from "expect";
import expectGas from "./expectGas";

const ICrowdsourcer = artifacts.require("ICrowdsourcer");
const Crowdsourcer = artifacts.require("Crowdsourcer");
const CrowdsourcerFactory = artifacts.require("CrowdsourcerFactory");
const AccountingFactory = artifacts.require("AccountingFactory");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");
const IERC20 = artifacts.require(
  "openzeppelin-solidity/contracts/token/ERC20/IERC20"
);

contract("CrowdsourcerFactory", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];

  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  it("can deploy", async () => {
    const accountingFactory = await AccountingFactory.new();
    const disputerFactory = await MockDisputerFactory.new(Alice, 10000, 0);
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

  it("is empty at first", async () => {
    const factory = await create_test_factory();
    await expect(
      factory.getNumCrowdsourcers(1).then(s => s.toString())
    ).resolves.toEqual("0");
    await expect(
      factory.findCrowdsourcer(42, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", ZERO_ADDRESS]);
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
      Alice,
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

  it("can find crowdsourcer", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 42, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 42, [], false);
    const c1 = await factory.maybeGetCrowdsourcer(Alice, 42, [], false);
    await expect(
      factory.getNumCrowdsourcers(41).then(s => s.toString())
    ).resolves.toEqual("0");
    await expect(
      factory.getNumCrowdsourcers(42).then(s => s.toString())
    ).resolves.toEqual("1");
    await expect(
      factory.findCrowdsourcer(41, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", ZERO_ADDRESS]);
    await expect(
      factory.findCrowdsourcer(42, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", c1]);
    await expect(
      factory.findCrowdsourcer(42, 1, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["1", ZERO_ADDRESS]);
    await expect(
      factory.findCrowdsourcer(42, 5, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["5", ZERO_ADDRESS]);
  });

  it("can find crowdsourcer: filters fees", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 42, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 42, [], false);
    const c1 = await factory.maybeGetCrowdsourcer(Alice, 42, [], false);
    const rep = await Crowdsourcer.at(c1)
      .getREP()
      .then(address => IERC20.at(address));
    await rep.approve(c1, 10000, { from: Alice });
    await Crowdsourcer.at(c1).contribute(1000, 42, { from: Alice });
    await expect(
      factory.findCrowdsourcer(42, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", c1]);
    await expect(
      factory.findCrowdsourcer(42, 0, 3, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", c1]);
    await expect(
      factory
        .findCrowdsourcer(42, 0, 50, [])
        .then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["1", ZERO_ADDRESS]);
  });

  it("can find crowdsourcer: filters uninitialized", async () => {
    const factory = await create_test_factory();
    await factory.getCrowdsourcer(Alice, 42, [], false);
    const c1 = await factory.maybeGetCrowdsourcer(Alice, 42, [], false);
    await expect(
      factory.getNumCrowdsourcers(42).then(s => s.toString())
    ).resolves.toEqual("1");
    await expect(
      factory.findCrowdsourcer(42, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["1", ZERO_ADDRESS]);
  });

  it("can find crowdsourcer: can iterate", async () => {
    const factory = await create_test_factory();

    await factory.getCrowdsourcer(Alice, 0, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 0, [], false);
    await factory.maybeGetCrowdsourcer(Alice, 0, [], false);

    await factory.getCrowdsourcer(Alice, 42, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 42, [], false);
    const c1 = await factory.maybeGetCrowdsourcer(Alice, 42, [], false);

    await factory.getCrowdsourcer(Bob, 42, [], false);
    await factory.getInitializedCrowdsourcer(Bob, 42, [], false);
    const c2 = await factory.maybeGetCrowdsourcer(Bob, 42, [], false);

    await expect(
      factory.getNumCrowdsourcers(42).then(s => s.toString())
    ).resolves.toEqual("2");

    await expect(
      factory.findCrowdsourcer(42, 0, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["0", c1]);
    await expect(
      factory.findCrowdsourcer(42, 1, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["1", c2]);
    await expect(
      factory.findCrowdsourcer(42, 2, 0, []).then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["2", ZERO_ADDRESS]);
  });

  it("can find crowdsourcer: can exclude", async () => {
    const factory = await create_test_factory();

    await factory.getCrowdsourcer(Alice, 0, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 0, [], false);
    await factory.maybeGetCrowdsourcer(Alice, 0, [], false);

    await factory.getCrowdsourcer(Alice, 42, [], false);
    await factory.getInitializedCrowdsourcer(Alice, 42, [], false);
    const c1 = await factory.maybeGetCrowdsourcer(Alice, 42, [], false);

    await factory.getCrowdsourcer(Bob, 42, [], false);
    await factory.getInitializedCrowdsourcer(Bob, 42, [], false);
    const c2 = await factory.maybeGetCrowdsourcer(Bob, 42, [], false);

    await expect(
      factory.getNumCrowdsourcers(42).then(s => s.toString())
    ).resolves.toEqual("2");

    await expect(
      factory
        .findCrowdsourcer(42, 0, 0, [c1])
        .then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["1", c2]);
    await expect(
      factory
        .findCrowdsourcer(42, 2, 0, [c1])
        .then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["2", ZERO_ADDRESS]);

    await expect(
      factory
        .findCrowdsourcer(42, 0, 0, [c1, c2])
        .then(a => a.map(s => s.toString()))
    ).resolves.toEqual(["2", ZERO_ADDRESS]);
  });

  it("cost of creating simple crowdsourcer", async () => {
    const factory = await create_test_factory();
    const receipt = await factory.getCrowdsourcer(Alice, 0, [5000, 5000], true);
    await expectGas(web3, receipt.receipt.gasUsed).resolves.toBe(2086626);
  });

  it("cost of creating bigger crowdsourcer", async () => {
    const factory = await create_test_factory();
    const receipt = await factory.getCrowdsourcer(
      Alice,
      4,
      [1, 2, 3, 4, 5, 6, 7, 8],
      false
    );
    await expectGas(web3, receipt.receipt.gasUsed).resolves.toBe(2211452);
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
    await expectGas(web3, receipt.receipt.gasUsed).resolves.toBe(2442932);
  });
});
