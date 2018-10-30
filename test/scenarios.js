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
        [Alice]: { proceeds: 0, refund: 1000 },
        fee: 0
      }
    },
    test0_1_single_contributor_full_dispute: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 970,
      expectations: {
        [Alice]: { proceeds: 970, refund: 0 },
        fee: 30
      }
    },
    test0_1_single_contributor_full_dispute_and_another_person_claiming: {
      contributions: {
        [Alice]: { amount: 1000, fee: 30 }
      },
      disputed: 970,
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
        [Bob]: { proceeds: 875, refund: 97 },
        fee: 27
      }
    },
    test0_1_single_contributor_partial_dispute_extreme_0: {
      contributions: {
        [Bob]: { amount: 1000, fee: 1 }
      },
      disputed: 875,
      expectations: {
        [Bob]: { proceeds: 875, refund: 124 },
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
      disputed: 9,
      expectations: {
        [Bob]: { proceeds: 9, refund: 91000 },
        fee: 8991
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
        [Alice]: { proceeds: 150, refund: 2843 },
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
        [Eve]: { proceeds: 31129, refund: 2573 },
        [John]: { proceeds: 13341, refund: 1103 },
        [Elena]: { proceeds: 0, refund: 80000 },
        fee: 2023
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
      disputed: 130229,
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
      allowRogueDisputeTokens: true,
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
      // Just test that strings are working
      contributions: {
        [Alice]: { amount: "1000", fee: 43 }
      },
      disputed: "955",
      expectations: {
        [Alice]: {
          proceeds: "955",
          refund: 2
        },
        fee: "42"
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
          refund: "3134796238244514105703"
        },
        fee: "42865203761755485893454"
      }
    }
  };

  ImmMap(raw)
    .filter(definition => !definition.allowRogueDisputeTokens)
    .forEach(definition =>
      expect(
        ImmMap(definition.contributions)
          .valueSeq()
          .map(contribution =>
            web3.utils
              .toBN(contribution.amount.toString())
              .mul(
                web3.utils
                  .toBN("1000")
                  .sub(web3.utils.toBN(contribution.fee.toString()))
              )
              .div(web3.utils.toBN("1000"))
          )
          .reduce((x, y) => x.add(y), web3.utils.toBN("0"))
          .gte(web3.utils.toBN(definition.disputed.toString()))
      ).toBe(true)
    );

  return raw;
}

export default getPayoutScenarioTests;
