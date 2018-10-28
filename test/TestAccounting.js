import expect from "expect";
import Prando from "prando";
import web3 from "web3";
import { generateMnemonic, EthHdWallet } from "eth-hd-wallet";
import { Map as ImmMap } from "immutable";

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
    expect(withdrawn.toNumber()).toEqual(9000);
    // then really run tx
    await instance.withdrawContribution(Bob, { from: Manager });
    await expect(
      instance.m_contributionPerContributor(Bob).then(n => n.toNumber())
    ).resolves.toEqual(0);
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

  const PAYOUT_SCENARIO_TESTS = {
    test0_0: {
      // test with no activity whatsoever
      contributions: {},
      disputed: 0,
      expectations: { fee: 0 }
    },
    test0_0_rogue: {
      // test with some rogue dispute tokens despite no contributions
      contributions: {},
      disputed: 14,
      expectations: { fee: 0 }
    },
    test0_0_single_contributor_no_dispute: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 0,
      expectations: {
        [Alice]: { proceeds: 0, refund: 1000 },
        fee: 0
      }
    },
    test0_1_single_contributor_full_dispute: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1000,
      expectations: {
        [Alice]: { proceeds: 970, refund: 0 },
        fee: 30
      }
    },
    test0_1_single_contributor_full_dispute_and_another_person_claiming: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1000,
      expectations: {
        [Alice]: { proceeds: 970, refund: 0 },
        [Bob]: { proceeds: 0, refund: 0 },
        fee: 30
      }
    },
    test0_1_single_contributor_partial_dispute: {
      contributions: {
        [Bob]: { amount: 1000, fee: 30 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 848, refund: 125 },
        fee: 26
      }
    },
    test0_1_single_contributor_partial_dispute_extreme_0: {
      contributions: {
        [Bob]: { amount: 1000, fee: 1 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 874, refund: 125 },
        fee: 0
      }
    },
    test0_1_single_contributor_partial_dispute_extreme_1: {
      contributions: {
        [Bob]: { amount: 1000, fee: 0 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 875, refund: 125 },
        fee: 0
      }
    },
    test0_1_single_contributor_partial_dispute_extreme_2: {
      contributions: {
        [Bob]: { amount: 1000, fee: 999 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 0, refund: 125 },
        fee: 874
      }
    },
    test0_2_single_contributor_full_dispute_with_rogue_tokens: {
      // someone sent extra 50 tokens into contract in attempt to break it
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1050,
      expectations: {
        [Alice]: { proceeds: 970, refund: 0 },
        fee: 30
      }
    },
    test1_two_contributors_story: {
      // in this case Alice partially gets in the dispute, while Bob does not
      // Alice wins 150 dispute tokens (143 after fee deducted), and 2850 REP
      // Bob gets 1000 REP
      // fee is 6 dispute tokens (4.3% of 150 dispute size)
      contributions: {
        [Bob]: { amount: 1000, fee: 42 },
        [Alice]: { amount: 3000, fee: 43 }
      },
      disputed: 150,
      expectations: {
        [Alice]: { proceeds: 143, refund: 2850 },
        [Bob]: { proceeds: 0, refund: 1000 },
        fee: 6
      }
    },
    test2_many_contributors_partial_same_bucket: {
      contributions: {
        [Alice]: { amount: 3000, fee: 43 },
        [Bob]: { amount: 1000, fee: 42 },
        [Eve]: { amount: 35000, fee: 40 },
        [John]: { amount: 15000, fee: 40 },
        [Elena]: { amount: 80000, fee: 20 }
      },
      disputed: 48299,
      expectations: {
        [Alice]: { proceeds: 2871, refund: 0 },
        [Bob]: { proceeds: 958, refund: 0 },
        [Eve]: { proceeds: 29768, refund: 3990 },
        [John]: { proceeds: 12758, refund: 1710 },
        [Elena]: { proceeds: 0, refund: 80000 },
        fee: 1942
      }
    },
    test2_many_contributors_full_same_bucket: {
      contributions: {
        [Alice]: { amount: 3000, fee: 43 },
        [Bob]: { amount: 1000, fee: 42 },
        [Eve]: { amount: 35000, fee: 40 },
        [John]: { amount: 15000, fee: 40 },
        [Elena]: { amount: 80000, fee: 20 }
      },
      disputed: 134000,
      expectations: {
        [Alice]: { proceeds: 2871, refund: 0 },
        [Bob]: { proceeds: 958, refund: 0 },
        [Eve]: { proceeds: 33600, refund: 0 },
        [John]: { proceeds: 14400, refund: 0 },
        [Elena]: { proceeds: 78400, refund: 0 },
        fee: 3771
      }
    },
    test2_many_contributors_full_same_bucket_with_rogue_funds: {
      contributions: {
        [Alice]: { amount: 3000, fee: 43 },
        [Bob]: { amount: 1000, fee: 42 },
        [Eve]: { amount: 35000, fee: 40 },
        [John]: { amount: 15000, fee: 40 },
        [Elena]: { amount: 80000, fee: 20 }
      },
      disputed: 135913,
      expectations: {
        [Alice]: { proceeds: 2871, refund: 0 },
        [Bob]: { proceeds: 958, refund: 0 },
        [Eve]: { proceeds: 33600, refund: 0 },
        [John]: { proceeds: 14400, refund: 0 },
        [Elena]: { proceeds: 78400, refund: 0 },
        fee: 3771
      }
    },
    test3_many_contributors_no_fill: {
      contributions: {
        [Alice]: { amount: 3000, fee: 43 },
        [Bob]: { amount: 1000, fee: 42 },
        [Eve]: { amount: 35000, fee: 40 },
        [John]: { amount: 15000, fee: 40 },
        [Elena]: { amount: 80000, fee: 20 }
      },
      disputed: 0,
      expectations: {
        [Alice]: { proceeds: 0, refund: 3000 },
        [Bob]: { proceeds: 0, refund: 1000 },
        [Eve]: { proceeds: 0, refund: 35000 },
        [John]: { proceeds: 0, refund: 15000 },
        [Elena]: { proceeds: 0, refund: 80000 },
        fee: 0
      }
    },
    test4_big_numbers_but_actually_small: {
      // Just test that BN are working
      contributions: {
        [Alice]: { amount: web3.utils.toBN(1000), fee: 43 }
      },
      disputed: web3.utils.toBN(1000).sub(web3.utils.toBN(1)),
      expectations: {
        [Alice]: {
          proceeds: web3.utils.toBN(956),
          refund: 1
        },
        fee: web3.utils.toBN(42)
      }
    },
    test5_big_numbers: {
      // test with 1,000,000 REP
      // this should overflow multiplication if not done carefully
      contributions: {
        [Alice]: {
          amount: web3.utils
            .toBN(1000000)
            .mul(web3.utils.toBN(10).pow(web3.utils.toBN(18))),
          fee: 43
        }
      },
      disputed: web3.utils
        .toBN(1000000)
        .mul(web3.utils.toBN(10).pow(web3.utils.toBN(18)))
        .sub(web3.utils.toBN(1)),
      expectations: {
        [Alice]: {
          proceeds: web3.utils.toBN("956999999999999999999999"),
          refund: 1
        },
        fee: web3.utils.toBN("42999999999999999999999")
      }
    }
  };

  ImmMap(PAYOUT_SCENARIO_TESTS)
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
      expect(withdrawn.toNumber()).toEqual(expectedBalance[address]);
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
