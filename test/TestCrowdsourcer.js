import { Set as ImmSet } from "immutable";
import expect from "expect";

const AccountingFactory = artifacts.require("AccountingFactory");
const Crowdsourcer = artifacts.require("Crowdsourcer");
const Accounting = artifacts.require("Accounting");
const IDisputer = artifacts.require("IDisputer");
const MockDisputerFactory = artifacts.require("MockDisputerFactory");
const MockCrowdsourcerParent = artifacts.require("MockCrowdsourcerParent");
const ICrowdsourcerParent = artifacts.require("ICrowdsourcerParent");
const IERC20 = artifacts.require(
  "openzeppelin-solidity/contracts/token/ERC20/IERC20"
);

contract("Crowdsourcer", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const JonathanFeeRecipient = accounts[2];
  const MartinREPHolder = accounts[3];
  const Eve = accounts[4];
  const John = accounts[5];
  const Elena = accounts[6];
  const Bob = accounts[7];
  const Executor = accounts[8];

  const create_test_crowdsourcer = async (
    repHolder,
    repSupply,
    disputeSize
  ) => {
    const disputerFactory = await MockDisputerFactory.new(
      repHolder,
      repSupply,
      disputeSize
    );
    await disputerFactory.prepareMocks();
    const mockCrowdsourcerParent = await MockCrowdsourcerParent.new(
      JonathanFeeRecipient
    );
    const accountingFactory = await AccountingFactory.new();
    return await Crowdsourcer.new(
      mockCrowdsourcerParent.address,
      accountingFactory.address,
      disputerFactory.address
    );
  };

  it("can deploy", async () => {
    await create_test_crowdsourcer(MartinREPHolder, 42, 3);
  });

  it("knows parent", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 42, 3);
    const parent = await instance.getParent();
    const feeReceiver = await ICrowdsourcerParent.at(
      parent
    ).getContractFeeReceiver();
    expect(feeReceiver).toEqual(JonathanFeeRecipient);
  });

  it("has correct initial state", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 1000, 100);
    await expect(
      Promise.all([
        instance.getDisputer(),
        instance.getAccounting(),
        instance.getREP(),
        instance.getDisputeToken()
      ]).then(addresses => ImmSet(addresses).size)
    ).resolves.toBe(4);

    await expect(instance.hasDisputed()).resolves.toBe(false);
    await expect(instance.isFinalized()).resolves.toBe(false);
  });

  it("test certain methods can't be called before dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 1000, 100);

    await expect(instance.finalize()).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
    await expect(instance.withdrawProceeds(Alice)).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
    await expect(instance.withdrawFees()).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("test can contribute and withdraw", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();
    const accounting = await instance.getAccounting();
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(10000);
    await rep.approve(instance.address, 10000, {
      from: MartinREPHolder
    });

    await instance.contribute(3000, 42, { from: MartinREPHolder });

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(7000);
    await expect(rep.balanceOf(disputer).then(b => b.toNumber())).resolves.toBe(
      3000
    );

    await expect(
      Accounting.at(accounting)
        .m_contributionPerContributor(MartinREPHolder)
        .then(n => n.toNumber())
    ).resolves.toBe(3000);

    await instance.withdrawContribution({ from: MartinREPHolder });

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(10000);
    await expect(rep.balanceOf(disputer).then(b => b.toNumber())).resolves.toBe(
      0
    );

    await expect(
      Accounting.at(accounting)
        .m_contributionPerContributor(MartinREPHolder)
        .then(n => n.toNumber())
    ).resolves.toBe(0);
  });

  it("cannot contribute weird amount", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();
    const accounting = await instance.getAccounting();
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(10000);
    await rep.approve(instance.address, 10000, {
      from: MartinREPHolder
    });

    await expect(
      instance.contribute(1120, 42, { from: MartinREPHolder })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("can withdraw 0 without having contributed", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    await instance.withdrawContribution({ from: Alice });
  });

  it("cannot contribute 0", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    await expect(instance.contribute(0, 42, { from: Alice })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("test cannot contribute while not having funds", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);

    await expect(
      instance.contribute(3000, 42, { from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("test cannot contribute while not having approval", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);

    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(10000);

    await expect(
      instance.contribute(3000, 42, { from: MartinREPHolder })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("test state after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 1000, 0);
    const disputer = await instance.getDisputer();

    await expect(instance.hasDisputed()).resolves.toBe(false);
    await expect(instance.isFinalized()).resolves.toBe(false);

    await IDisputer.at(disputer).dispute(Alice);

    await expect(instance.hasDisputed()).resolves.toBe(true);
    await expect(instance.isFinalized()).resolves.toBe(false);
  });

  it("test cannot contribute after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toBe(10000);
    await rep.approve(instance.address, 10000, {
      from: MartinREPHolder
    });

    await expect(
      instance.contribute(3000, 42, { from: MartinREPHolder })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("test cannot withdraw after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    await expect(
      instance.withdrawContribution({ from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("can finalize after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    await expect(instance.hasDisputed()).resolves.toBe(true);
    await expect(instance.isFinalized()).resolves.toBe(false);

    await instance.finalize();

    await expect(instance.hasDisputed()).resolves.toBe(true);
    await expect(instance.isFinalized()).resolves.toBe(true);
  });

  it("cannot finalize twice", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    await instance.finalize();

    await expect(instance.finalize()).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("fees collection causes finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    expect(instance.isFinalized()).resolves.toBe(false);

    await instance.withdrawFees();

    expect(instance.isFinalized()).resolves.toBe(true);
  });

  it("proceeds collection causes finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    expect(instance.isFinalized()).resolves.toBe(false);

    await instance.withdrawProceeds(Alice);

    expect(instance.isFinalized()).resolves.toBe(true);
  });

  it("fees collection is possible after finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.finalize();
    await instance.withdrawFees();
  });

  it("proceeds collection is possible after finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.finalize();
    await instance.withdrawProceeds(Alice);
  });
});
