import expect from "expect";
import Prando from "prando";
import web3 from "web3";
import { generateMnemonic, EthHdWallet } from "eth-hd-wallet";
import { Map as ImmMap } from "immutable";
import getPayoutScenarioTests from "./scenarios";

const Accounting = artifacts.require("Accounting");

contract("Accounting", accounts => {
  const Manager = accounts[0];
  const Alice = accounts[1];
  const Bob = accounts[2];
  const Eve = accounts[3];
  const John = accounts[4];
  const Elena = accounts[5];

  it("can deploy", async () => {
    await Accounting.new(Manager);
  });

  it("knows owner", async () => {
    const instance = await Accounting.new(Manager);
    const owner = await instance.m_owner();
    expect(owner).toEqual(Manager);
  });

  it("will refuse to call mutable methods from non-owner", async () => {
    const instance = await Accounting.new(Manager);
    await expect(
      instance.contribute(Bob, 1000, 42, { from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(
      instance.withdrawContribution(Bob, { from: Alice })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(instance.finalize(42, { from: Bob })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("can contribute", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    const contributionForBob = await instance.m_contributionPerContributor(Bob);
    expect(contributionForBob.toNumber()).toEqual(1000);
    const feeForBob = await instance.m_feeNumeratorPerContributor(Bob);
    expect(feeForBob.toNumber()).toEqual(42);
    const contributionFor42 = await instance.m_contributionPerFeeNumerator(42);
    expect(contributionFor42.toNumber()).toEqual(1000);
  });

  it("cannot contribute bad amount", async () => {
    const instance = await Accounting.new(Manager);
    await expect(
      instance.contribute(Bob, 1043, 42, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(
      instance.contribute(Bob, 0, 42, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("cannot contribute bad fee", async () => {
    const instance = await Accounting.new(Manager);
    await expect(
      instance.contribute(Bob, 1000, 1000, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(
      instance.contribute(Bob, 1000, 1001, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("cannot contribute twice", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    await expect(
      instance.contribute(Bob, 1000, 42, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
  });

  it("two people can contribute with same fee", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    await instance.contribute(Alice, 3000, 42, { from: Manager });
    const contributionForBob = await instance.m_contributionPerContributor(Bob);
    expect(contributionForBob.toNumber()).toEqual(1000);
    const feeForBob = await instance.m_feeNumeratorPerContributor(Bob);
    expect(feeForBob.toNumber()).toEqual(42);
    const contributionForAlice = await instance.m_contributionPerContributor(
      Alice
    );
    expect(contributionForAlice.toNumber()).toEqual(3000);
    const feeForAlice = await instance.m_feeNumeratorPerContributor(Alice);
    expect(feeForAlice.toNumber()).toEqual(42);
    const contributionFor42 = await instance.m_contributionPerFeeNumerator(42);
    expect(contributionFor42.toNumber()).toEqual(4000);
  });

  it("two people can contribute with different fees", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    await instance.contribute(Alice, 3000, 43, { from: Manager });
    const contributionForBob = await instance.m_contributionPerContributor(Bob);
    expect(contributionForBob.toNumber()).toEqual(1000);
    const feeForBob = await instance.m_feeNumeratorPerContributor(Bob);
    expect(feeForBob.toNumber()).toEqual(42);
    const contributionForAlice = await instance.m_contributionPerContributor(
      Alice
    );
    expect(contributionForAlice.toNumber()).toEqual(3000);
    const feeForAlice = await instance.m_feeNumeratorPerContributor(Alice);
    expect(feeForAlice.toNumber()).toEqual(43);
    const contributionFor42 = await instance.m_contributionPerFeeNumerator(42);
    expect(contributionFor42.toNumber()).toEqual(1000);
    const contributionFor43 = await instance.m_contributionPerFeeNumerator(43);
    expect(contributionFor43.toNumber()).toEqual(3000);
  });

  it("calculates total contribution and fees after contributions", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    await instance.contribute(Alice, 3000, 43, { from: Manager });
    await expect(
      instance.getTotalContribution().then(s => s.toString())
    ).resolves.toBe("4000");
    await expect(
      instance.getTotalFeesOffered().then(s => s.toString())
    ).resolves.toBe("171");
  });

  it("calculates total contribution and fees after contributions and withdrawals", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 1000, 42, { from: Manager });
    await instance.contribute(Alice, 3000, 43, { from: Manager });
    await instance.withdrawContribution(Bob, { from: Manager });
    await expect(
      instance.getTotalContribution().then(s => s.toString())
    ).resolves.toBe("3000");
    await expect(
      instance.getTotalFeesOffered().then(s => s.toString())
    ).resolves.toBe("129");
  });

  it("will refuse to call mutable methods after finalization", async () => {
    const instance = await Accounting.new(Manager);
    await instance.finalize(42, { from: Manager });
    await expect(
      instance.contribute(Bob, 1000, 42, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(
      instance.withdrawContribution(Bob, { from: Manager })
    ).rejects.toThrow("VM Exception while processing transaction: revert");
    await expect(instance.finalize(42, { from: Manager })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("can contribute and then withdraw", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 9000, 42, { from: Manager });
    // first just peek at the result
    const withdrawn = await instance.withdrawContribution.call(Bob, {
      from: Manager
    });
    expect(withdrawn.map(n => n.toNumber())).toEqual([9000, 378]);
    // then really run tx
    await instance.withdrawContribution(Bob, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(0);
  });

  it("can contribute and then withdraw and then again contribute with different fee", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 9000, 42, { from: Manager });
    // first just peek at the result
    const withdrawn = await instance.withdrawContribution.call(Bob, {
      from: Manager
    });
    expect(withdrawn.map(n => n.toNumber())).toEqual([9000, 378]);
    // then really run tx
    await instance.withdrawContribution(Bob, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(0);

    await instance.contribute(Bob, 3000, 43, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(3000);
  });

  it("can contribute and then withdraw and then again contribute with same fee", async () => {
    const instance = await Accounting.new(Manager);
    await instance.contribute(Bob, 9000, 42, { from: Manager });
    // first just peek at the result
    const withdrawn = await instance.withdrawContribution.call(Bob, {
      from: Manager
    });
    expect(withdrawn.map(n => n.toNumber())).toEqual([9000, 378]);
    // then really run tx
    await instance.withdrawContribution(Bob, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(0);

    await instance.contribute(Bob, 3000, 42, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(3000);
  });

  it("can finalize", async () => {
    const instance = await Accounting.new(Manager);
    await instance.finalize(42, { from: Manager });
  });

  it("cannot finalize twice", async () => {
    const instance = await Accounting.new(Manager);
    await instance.finalize(42, { from: Manager });
    await expect(instance.finalize(42, { from: Manager })).rejects.toThrow(
      "VM Exception while processing transaction: revert"
    );
  });

  it("test big numbers work", () => {
    expect(web3.utils.toBN("100").toString()).toBe("100");
    expect(web3.utils.toBN(100).toString()).toBe("100");
    expect(web3.utils.toBN(1e2).toString()).toBe("100");
    expect(web3.utils.toBN(10e1).toString()).toBe("100");
    expect(web3.utils.toBN(100e18).toString()).toBe("100000000000000000000");
    expect(web3.utils.toBN("995699999999999999999999").toString()).toBe(
      "995699999999999999999999"
    );
  });

  ImmMap(getPayoutScenarioTests({ Alice, Bob, Eve, John, Elena }))
    .entrySeq()
    .sort()
    .forEach(([name, definition]) =>
      it(`Payout scenario test <${name}>`, async () => {
        const instance = await Accounting.new(Manager);
        // run all contributions from scenario
        await Promise.all(
          ImmMap(definition.contributions)
            .map(
              async (contribution, address) =>
                await instance.contribute(
                  address,
                  contribution.amount.toString(),
                  contribution.fee.toString(),
                  { from: Manager }
                )
            )
            .valueSeq()
            .toArray()
        );

        // finalize state
        await instance.finalize(definition.disputed.toString(), {
          from: Manager
        });

        // check all proceeds/refunds sequentially (to avoid mess in test logs)
        await ImmMap(definition.expectations)
          .delete("fee")
          .entrySeq()
          .sort()
          .map(([address, expectation]) => async () => {
            const [rep, disputeTokens] = await instance.calculateProceeds(
              address
            );
            expect(rep.toFixed()).toEqual(expectation.refund.toString());
            expect(disputeTokens.toFixed()).toEqual(
              expectation.proceeds.toString()
            );
          })
          .reduce(
            (f1, f2) => async () => {
              await f1();
              await f2();
            },
            async () => {}
          )();

        // finally check fees
        const fees = await instance.calculateFees();
        expect(fees.toFixed()).toEqual(definition.expectations.fee.toString());
      })
    );

  it("fuzz test of contribute and withdraw", async () => {
    const instance = await Accounting.new(Manager);

    // will create a bunch of addresses, simulate deposits and withdrawals
    // and compare contract implementation with JS
    const wallet = EthHdWallet.fromMnemonic(generateMnemonic());
    const addresses = wallet.generateAddresses(1000);

    const expectedFeeNumerator = {};
    const expectedBalance = {};

    const rng = new Prando("Some static seed");

    for (const address of addresses) {
      const amount = rng.nextInt(1, 2018) * 1000;
      const fee = rng.nextInt(0, 999);
      expectedFeeNumerator[address] = fee;
      expectedBalance[address] = amount;
      await instance.contribute(address, amount, fee, { from: Manager });
    }

    for (const address of addresses) {
      if (rng.nextInt(0, 4) !== 0) {
        // only some fraction of addresses withdraw
        continue;
      }
      const withdrawn = await instance.withdrawContribution.call(address, {
        from: Manager
      });
      expect(withdrawn.map(n => n.toNumber())).toEqual([
        expectedBalance[address],
        (expectedBalance[address] * expectedFeeNumerator[address]) / 1000
      ]);
      expectedBalance[address] = 0;
      await instance.withdrawContribution(address, { from: Manager });
    }

    for (const address of addresses) {
      await expect(
        instance.m_contributionPerContributor(address).then(n => n.toNumber())
      ).resolves.toEqual(expectedBalance[address]);
      await expect(
        instance.m_feeNumeratorPerContributor(address).then(n => n.toNumber())
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
        instance
          .m_contributionPerFeeNumerator(feeNumerator)
          .then(n => n.toNumber())
      ).resolves.toEqual(expectedBalanceForFee);
    }
  });
});
