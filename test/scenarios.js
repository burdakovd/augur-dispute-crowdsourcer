import web3 from "web3";
import expect from "expect";
import { Map as ImmMap } from "immutable";

function getPayoutScenarioTests({ Alice, Bob, Eve, John, Elena }) {
  const raw = {
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
      allowRogueDisputeTokens: true,
      expectations: { fee: 0 }
    },
    test0_0_single_contributor_no_dispute: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 0,
      expectations: {
        [Alice]: { proceeds: 0, refund: 1030 },
        fee: 0
      }
    },
    test0_1_single_contributor_full_dispute: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1000,
      expectations: {
        [Alice]: { proceeds: 1000, refund: 30 },
        fee: 0
      }
    },
    test0_1_single_contributor_full_dispute_and_another_person_claiming: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1000,
      expectations: {
        [Alice]: { proceeds: 1000, refund: 30 },
        [Bob]: { proceeds: 0, refund: 0 },
        fee: 0
      }
    },
    test0_1_single_contributor_partial_dispute: {
      contributions: {
        [Bob]: { amount: 1000, fee: 30 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 875, refund: 128 },
        fee: 26
      }
    },
    test0_1_single_contributor_partial_dispute_extreme_0: {
      contributions: {
        [Bob]: { amount: 1000, fee: 1 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 875, refund: 125 },
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
        [Bob]: { amount: 100000, fee: 999 }
      },
      disputed: 2018,
      expectations: {
        [Bob]: { proceeds: 2018, refund: 195866 },
        fee: 2015
      }
    },
    test0_2_single_contributor_full_dispute_with_rogue_tokens: {
      // someone sent extra 80 tokens into contract in attempt to break it
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 1050,
      allowRogueDisputeTokens: true,
      expectations: {
        [Alice]: { proceeds: 1000, refund: 30 },
        fee: 0
      }
    },
    test1_two_contributors_story: {
      // in this case Alice partially gets in the dispute, while Bob does not
      // Alice wins 150 dispute tokens, and 2843 REP
      // Bob gets 1000 REP
      // fee is 6 REP (150/0.957*0.043)
      contributions: {
        [Bob]: { amount: 1000, fee: 42 },
        [Alice]: { amount: 3000, fee: 43 }
      },
      disputed: 150,
      expectations: {
        [Alice]: { proceeds: 150, refund: 2972 },
        [Bob]: { proceeds: 0, refund: 1042 },
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
        [Alice]: { proceeds: 3000, refund: 9 },
        [Bob]: { proceeds: 1000, refund: 2 },
        [Eve]: { proceeds: 31009, refund: 4150 },
        [John]: { proceeds: 13289, refund: 1778 },
        [Elena]: { proceeds: 0, refund: 81600 },
        fee: 1931
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
        [Alice]: { proceeds: 3000, refund: 129 },
        [Bob]: { proceeds: 1000, refund: 42 },
        [Eve]: { proceeds: 35000, refund: 1400 },
        [John]: { proceeds: 15000, refund: 600 },
        [Elena]: { proceeds: 80000, refund: 1600 },
        fee: 0
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
      allowRogueDisputeTokens: true,
      expectations: {
        [Alice]: { proceeds: 3000, refund: 129 },
        [Bob]: { proceeds: 1000, refund: 42 },
        [Eve]: { proceeds: 35000, refund: 1400 },
        [John]: { proceeds: 15000, refund: 600 },
        [Elena]: { proceeds: 80000, refund: 1600 },
        fee: 0
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
        [Alice]: { proceeds: 0, refund: 3129 },
        [Bob]: { proceeds: 0, refund: 1042 },
        [Eve]: { proceeds: 0, refund: 36400 },
        [John]: { proceeds: 0, refund: 15600 },
        [Elena]: { proceeds: 0, refund: 81600 },
        fee: 0
      }
    },
    test4_big_numbers_but_actually_small: {
      // Just test that strings are working
      contributions: {
        [Alice]: { amount: "1000", fee: 43 }
      },
      disputed: "955",
      expectations: {
        [Alice]: {
          proceeds: "955",
          refund: 46
        },
        fee: "41"
      }
    },
    test5_big_numbers: {
      // test with 1,000,000 REP
      // this should overflow multiplication if not done carefully
      contributions: {
        [Alice]: {
          amount: web3.utils
            .toBN(1000000)
            .mul(web3.utils.toBN(10).pow(web3.utils.toBN(18)))
            .toString(),
          fee: 43
        }
      },
      disputed: "954000000000000000000842",
      expectations: {
        [Alice]: {
          proceeds: "954000000000000000000842",
          refund: "47977999999999999999121"
        },
        fee: "41022000000000000000036"
      }
    }
  };

  ImmMap(raw).forEach(definition =>
    expect(
      ImmMap(definition.contributions)
        .valueSeq()
        .map(contribution => web3.utils.toBN(contribution.amount.toString()))
        .reduce((x, y) => x.add(y), web3.utils.toBN("0"))
        .gte(web3.utils.toBN(definition.disputed.toString()))
    ).toBe(!definition.allowRogueDisputeTokens)
  );

  return raw;
}

export default getPayoutScenarioTests;
