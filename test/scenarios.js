import web3 from "web3";

function getPayoutScenarioTests({ Alice, Bob, Eve, John, Elena }) {
  return {
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
}

export default getPayoutScenarioTests;
