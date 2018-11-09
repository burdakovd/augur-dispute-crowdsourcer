import { Set as ImmSet, Map as ImmMap } from "immutable";
import expect from "expect";
const truffleWeb3 = global.web3;
import web3 from "web3";
import Prando from "prando";
import getPayoutScenarioTests from "./scenarios";
import expectGas from "./expectGas";

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
  const DonaldManager = accounts[0];
  const Alice = accounts[1];
  const GeorgeContractAuthor = accounts[2];
  const MartinREPHolder = accounts[3];
  const Eve = accounts[4];
  const John = accounts[5];
  const Elena = accounts[6];
  const Bob = accounts[7];
  const IvanExecutor = accounts[8];

  const MAX_UINT256 =
    "115792089237316195423570985008687907853269984665640564039457584007913129639935";

  const create_test_crowdsourcer = async (
    repHolder,
    repSupply,
    disputeSize,
    shouldInitialize = true
  ) => {
    const disputerFactory = await MockDisputerFactory.new(
      repHolder,
      repSupply,
      disputeSize
    );
    await disputerFactory.prepareMocks();
    const mockCrowdsourcerParent = await MockCrowdsourcerParent.new(
      GeorgeContractAuthor
    );
    const accountingFactory = await AccountingFactory.new();
    const crowdsourcer = await Crowdsourcer.new(
      mockCrowdsourcerParent.address,
      accountingFactory.address,
      disputerFactory.address,
      0x1234,
      42,
      [3, 4, 15, 16, 23, 42],
      true
    );

    if (shouldInitialize) {
      await crowdsourcer.initialize();
    }

    crowdsourcer.__burnRep = async (account, amount) =>
      await disputerFactory.burnREP(account, amount);

    return crowdsourcer;
  };

  it("can deploy", async () => {
    await create_test_crowdsourcer(MartinREPHolder, 42, 3, false);
  });

  it("can deploy and initialize", async () => {
    await create_test_crowdsourcer(MartinREPHolder, 42, 3);
  });

  it("cannot initialize twice", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 42, 3);
    await expect(instance.initialize()).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("knows parent", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 42, 3);
    const parent = await instance.getParent();
    const feeReceiver = await ICrowdsourcerParent.at(
      parent
    ).getContractFeeReceiver();
    expect(feeReceiver).toEqual(GeorgeContractAuthor);
  });

  it("can read params", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 42, 3);
    const params = await instance
      .getDisputerParams()
      .then(([m, f, p, i]) => [m, f.toString(), p.map(n => n.toString()), i]);
    expect(params).toEqual([
      "0x0000000000000000000000000000000000001234",
      "42",
      ["3", "4", "15", "16", "23", "42"],
      true
    ]);
  });

  it("has correct initial state", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 1000, 100);
    await expect(
      Promise.all([
        instance.getDisputer(),
        instance.getAccounting(),
        instance.getREP()
      ]).then(addresses => ImmSet(addresses).size)
    ).resolves.toEqual(3);

    await expect(instance.hasDisputed()).resolves.toEqual(false);
    await expect(instance.isFinalized()).resolves.toEqual(false);
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
    ).resolves.toEqual(10000);
    await rep.approve(instance.address, 10000, {
      from: MartinREPHolder
    });

    await expectGas(
      truffleWeb3,
      instance
        .contribute(3000, 42, { from: MartinREPHolder })
        .then(receipt => receipt.receipt.gasUsed)
    ).resolves.toBe(219829);

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toEqual(6874);
    await expect(
      rep.balanceOf(instance.address).then(b => b.toNumber())
    ).resolves.toEqual(126);
    await expect(
      rep.balanceOf(disputer).then(b => b.toNumber())
    ).resolves.toEqual(3000);

    await expect(
      Accounting.at(accounting)
        .m_contributionPerContributor(MartinREPHolder)
        .then(n => n.toNumber())
    ).resolves.toEqual(3000);

    await expectGas(
      truffleWeb3,
      instance
        .withdrawContribution({ from: MartinREPHolder })
        .then(receipt => receipt.receipt.gasUsed)
    ).resolves.toBe(53697);

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toEqual(10000);
    await expect(
      rep.balanceOf(disputer).then(b => b.toNumber())
    ).resolves.toEqual(0);

    await expect(
      Accounting.at(accounting)
        .m_contributionPerContributor(MartinREPHolder)
        .then(n => n.toNumber())
    ).resolves.toBe(0);
  });

  it("detects funds loss in crowdsourcer", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await rep.transfer(Alice, 5000, { from: MartinREPHolder });

    await rep.approve(instance.address, 5000, {
      from: MartinREPHolder
    });
    await rep.approve(instance.address, 5000, {
      from: Alice
    });

    await instance.contribute(1000, 42, { from: Alice });

    // lose one attorep
    await instance.__burnRep(instance.address, 1);

    await expect(
      instance.contribute(1000, 42, { from: MartinREPHolder })
    ).rejects.toThrow(
      "VM Exception while processing transaction: invalid opcode"
    );
  });

  it("detects funds loss in disputer", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await rep.transfer(Alice, 5000, { from: MartinREPHolder });

    await rep.approve(instance.address, 5000, {
      from: MartinREPHolder
    });
    await rep.approve(instance.address, 5000, {
      from: Alice
    });

    await instance.contribute(1000, 42, { from: Alice });

    // lose one attorep
    await instance.__burnRep(disputer, 1);

    await expect(
      instance.contribute(1000, 42, { from: MartinREPHolder })
    ).rejects.toThrow(
      "VM Exception while processing transaction: invalid opcode"
    );
  });

  it("detects funds loss in disputer when withdrawing", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await rep.transfer(Alice, 5000, { from: MartinREPHolder });

    await rep.approve(instance.address, 5000, {
      from: MartinREPHolder
    });
    await rep.approve(instance.address, 5000, {
      from: Alice
    });

    await instance.contribute(1000, 42, { from: Alice });
    await instance.contribute(1000, 42, { from: MartinREPHolder });

    // lose one attorep
    await instance.__burnRep(disputer, 1);

    await expect(
      instance.withdrawContribution({ from: Alice })
    ).rejects.toThrow(
      "VM Exception while processing transaction: invalid opcode"
    );
  });

  it("cannot contribute weird amount", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();
    const accounting = await instance.getAccounting();
    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toEqual(10000);
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

  it("cannot withdraw without initialization", async () => {
    const instance = await create_test_crowdsourcer(
      MartinREPHolder,
      10000,
      0,
      false
    );
    await expect(
      instance.withdrawContribution({ from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await instance.initialize();
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
    ).resolves.toEqual(10000);

    await expect(
      instance.contribute(3000, 42, { from: MartinREPHolder })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("test state after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 1000, 0);
    const disputer = await instance.getDisputer();

    await expect(instance.hasDisputed()).resolves.toEqual(false);
    await expect(instance.isFinalized()).resolves.toEqual(false);

    await IDisputer.at(disputer).dispute(Alice);

    await expect(instance.hasDisputed()).resolves.toEqual(true);
    await expect(instance.isFinalized()).resolves.toEqual(false);
  });

  it("test cannot contribute after dispute", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    const rep = await instance.getREP().then(address => IERC20.at(address));

    await expect(
      rep.balanceOf(MartinREPHolder).then(b => b.toNumber())
    ).resolves.toEqual(10000);
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

    await expect(instance.hasDisputed()).resolves.toEqual(true);
    await expect(instance.isFinalized()).resolves.toEqual(false);

    await expectGas(
      truffleWeb3,
      instance.finalize().then(receipt => receipt.receipt.gasUsed)
    ).resolves.toBe(1112596);

    await expect(instance.hasDisputed()).resolves.toEqual(true);
    await expect(instance.isFinalized()).resolves.toEqual(true);
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

    expect(instance.isFinalized()).resolves.toEqual(false);

    await instance.withdrawFees();

    expect(instance.isFinalized()).resolves.toEqual(true);
  });

  it("proceeds collection causes finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);

    expect(instance.isFinalized()).resolves.toEqual(false);

    await instance.withdrawProceeds(Alice);

    expect(instance.isFinalized()).resolves.toEqual(true);
  });

  it("fees collection is possible after finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.finalize();
    await expectGas(
      truffleWeb3,
      instance.withdrawFees().then(receipt => receipt.receipt.gasUsed)
    ).resolves.toBe(90881);
  });

  it("proceeds collection is possible after finalization", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.finalize();
    await expectGas(
      truffleWeb3,
      instance.withdrawProceeds(Alice).then(receipt => receipt.receipt.gasUsed)
    ).resolves.toBe(89895);
  });

  it("cannot collect fees twice", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.withdrawFees();
    await expect(instance.withdrawFees()).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("cannot collect proceeds twice for same address", async () => {
    const instance = await create_test_crowdsourcer(MartinREPHolder, 10000, 0);
    const disputer = await instance.getDisputer();

    await IDisputer.at(disputer).dispute(Alice);
    await instance.withdrawProceeds(Alice);
    await expect(instance.withdrawProceeds(Alice)).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("fuzz test of contribute and withdraw", async () => {
    const crowdsourcer = await create_test_crowdsourcer(
      MartinREPHolder,
      11000000,
      0
    );
    const rep = await crowdsourcer.getREP().then(address => IERC20.at(address));
    const accounting = await crowdsourcer
      .getAccounting()
      .then(address => Accounting.at(address));

    // simulate deposits and withdrawals
    // and compare contract implementation with JS
    const addresses = [Alice, Bob, Eve, John, Elena];

    const expectedFeeNumerator = {};
    const expectedBalance = {};

    const rng = new Prando("Some static seed for TestCrowdsourcer");

    for (const address of addresses) {
      const amount = rng.nextInt(1, 2018) * 1000;
      const fee = rng.nextInt(0, 149);
      expectedFeeNumerator[address] = fee;
      expectedBalance[address] = amount;
      await rep.transfer(address, amount * (1 + fee / 1000), {
        from: MartinREPHolder
      });
      await rep.approve(crowdsourcer.address, amount * (1 + fee / 1000), {
        from: address
      });
      await crowdsourcer.contribute(amount, fee, { from: address });
      await expect(
        rep.balanceOf(address).then(n => n.toNumber())
      ).resolves.toEqual(0);
    }

    for (const address of addresses) {
      if (rng.nextInt(0, 1) !== 0) {
        // only some fraction of addresses withdraw
        continue;
      }
      await crowdsourcer.withdrawContribution({ from: address });
      await expect(
        rep.balanceOf(address).then(n => n.toNumber())
      ).resolves.toEqual(
        expectedBalance[address] * (1 + expectedFeeNumerator[address] / 1000)
      );
      expectedBalance[address] = 0;
    }

    for (const address of addresses) {
      await expect(
        accounting.m_contributionPerContributor(address).then(n => n.toNumber())
      ).resolves.toEqual(expectedBalance[address]);
      await expect(
        accounting.m_feeNumeratorPerContributor(address).then(n => n.toNumber())
      ).resolves.toEqual(expectedFeeNumerator[address]);
    }

    for (var feeNumerator = 0; feeNumerator < 1000; ++feeNumerator) {
      var expectedBalanceForFee = 0;
      for (const address of addresses) {
        if (expectedFeeNumerator[address] === feeNumerator) {
          expectedBalanceForFee += expectedBalance[address];
        }
      }
      await expect(
        accounting
          .m_contributionPerFeeNumerator(feeNumerator)
          .then(n => n.toNumber())
      ).resolves.toEqual(expectedBalanceForFee);
    }
  });

  ImmMap(getPayoutScenarioTests({ Alice, Bob, Eve, John, Elena }))
    .entrySeq()
    .sort()
    .forEach(([name, definition]) =>
      it(`Payout scenario test <${name}>`, async () => {
        const crowdsourcer = await create_test_crowdsourcer(
          MartinREPHolder,
          MAX_UINT256,
          definition.disputed.toString()
        );
        const rep = await crowdsourcer
          .getREP()
          .then(address => IERC20.at(address));
        const disputer = await crowdsourcer
          .getDisputer()
          .then(address => IDisputer.at(address));

        // run all contributions from scenario
        // sequentially (to avoid mess in test logs)
        await ImmMap(definition.contributions)
          .entrySeq()
          .sort()
          .map(([address, contribution]) => async () => {
            const amountWithFee = web3.utils
              .toBN(contribution.amount)
              .mul(web3.utils.toBN(1000 + contribution.fee))
              .div(web3.utils.toBN(1000));
            await rep.transfer(address, amountWithFee.toString(), {
              from: MartinREPHolder
            });
            await rep.approve(crowdsourcer.address, amountWithFee.toString(), {
              from: address
            });
            await crowdsourcer.contribute(
              contribution.amount,
              contribution.fee,
              { from: address }
            );
          })
          .reduce(
            (f1, f2) => async () => {
              await f1();
              await f2();
            },
            async () => {}
          )();

        // finalize state
        await disputer.dispute(IvanExecutor);
        await crowdsourcer.finalize();

        const disputeToken = await crowdsourcer
          .getDisputeToken()
          .then(address => IERC20.at(address));

        // check all proceeds/refunds sequentially (to avoid mess in test logs)
        await ImmMap(definition.expectations)
          .delete("fee")
          .entrySeq()
          .sort()
          .map(([address, expectation]) => async () => {
            await expect(
              rep.balanceOf(address).then(n => n.toNumber())
            ).resolves.toEqual(0);
            await expect(
              disputeToken.balanceOf(address).then(n => n.toNumber())
            ).resolves.toEqual(0);

            await crowdsourcer.withdrawProceeds(address);

            await expect(
              rep.balanceOf(address).then(n => n.toFixed())
            ).resolves.toEqual(expectation.refund.toString());
            await expect(
              disputeToken.balanceOf(address).then(n => n.toFixed())
            ).resolves.toEqual(expectation.proceeds.toString());
          })
          .reduce(
            (f1, f2) => async () => {
              await f1();
              await f2();
            },
            async () => {}
          )();

        // finally check fees
        await expect(
          rep.balanceOf(GeorgeContractAuthor).then(n => n.toNumber())
        ).resolves.toEqual(0);
        await expect(
          rep.balanceOf(IvanExecutor).then(n => n.toNumber())
        ).resolves.toEqual(0);

        await crowdsourcer.withdrawFees();

        await expect(
          rep.balanceOf(GeorgeContractAuthor).then(n => n.toFixed())
        ).resolves.toEqual(
          web3.utils
            .toBN(definition.expectations.fee.toString())
            .divn(web3.utils.toBN("10"))
            .toString()
        );
        await expect(
          rep.balanceOf(IvanExecutor).then(n => n.toFixed())
        ).resolves.toEqual(
          (x => x.sub(x.divn(web3.utils.toBN("10"))))(
            web3.utils.toBN(definition.expectations.fee.toString())
          ).toString()
        );
      })
    );
});
