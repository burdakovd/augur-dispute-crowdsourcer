# augur-dispute-crowdsourcer

[![Build Status](https://travis-ci.com/burdakovd/augur-dispute-crowdsourcer.svg?branch=master)](https://travis-ci.com/burdakovd/augur-dispute-crowdsourcer) [![Coverage Status](https://coveralls.io/repos/github/burdakovd/augur-dispute-crowdsourcer/badge.svg?branch=master)](https://coveralls.io/github/burdakovd/augur-dispute-crowdsourcer?branch=master)

Contract to let people crowdsource funds for Augur disputes, and then submit them in one tx

Reddit post about release: https://www.reddit.com/r/Augur/comments/9u6pmn/new_disputing_pool_for_augur/

Bounty market: https://www.reddit.com/r/AugurTrader/comments/9v7awy/augurdisputecrowdsourcer_bounty_market_round_2/



UI: https://github.com/burdakovd/augur-dispute-crowdsourcer-ui

Executor (can be used to trigger disputes and collect fees automatically): https://github.com/burdakovd/augur-crowdsourcer-basic-executor/

# Releases

v0.1:

- mainnet: https://etherscan.io/address/0x14610b493f024c3636decbf7acbc201dfda44d47
- rinkeby: https://rinkeby.etherscan.io/address/0x751ee7d9a87585359c671b737dc39cd7ea9f7d56

v0.1.2:

- mainnet: https://etherscan.io/address/0x240c61c9ac8b87bc70813be9ba069c0b45e83c9a
- rinkeby: https://rinkeby.etherscan.io/address/0xdf43f34d894a68e8a563c59de0de930e29c73c4d

# General rules

You need of course to understand how Augur dispute system works before using this contract. I won't go into details of it, but I will assume knowledge.

If some dispute outcome is very popular, it becomes a rush to get your transaction in at the beginning of dispute window. This pool aims to improve the stuation. People can contrubute into the pool ahead of time (while choosing max fee they are willing to pay for getting in), then once the dispute window starts, anyone can trigger the dispute with all the REP from the pool. Afterwards, participants can collect their dispute tokens and unused REP. Fee will be taken from them, and awarded to the person who triggered dispute (90%) and to contract author (10%). The final fee is chosen to be the minimal fee that would still allow to get in all particpants that fee higher than that.

For each combination of `<market, round, disputeOutcome>` a crowdsourcing pool can be created, normally it happens before dispute window.

After that participants can contribute (choosing amount and fee) and withdraw their contributions from the pool as many times as they want.

Once dispute window starts, anyone can trigger duspute. Dispute can be triggered only once, subsequent transactions will fail. Disputing before window starts is not possible (Augur will reject it).

After dispute happened, people can collect their proceeds and refund of unused REP.

# Examples of fees calculation

More examples here: https://github.com/burdakovd/augur-dispute-crowdsourcer/blob/master/test/scenarios.js

## Example 1

Alice contributed 100 REP, and offered 10% fee (10 REP on top).

Bob contributed 10 REP, and offered 1% fee (0.1 REP on top).

During dispute, pool managed to get all 110 REP into the dispute round.

Since all REP got in, lowest possible fee is 0%.

Alice can get 100 dispute tokens, and refund of 10 REP.

Bob can get 10 dispute tokens, and refund of 0.1 REP.

## Example 2

Alice contributed 100 REP, and offered 10% fee (10 REP on top).

Eve contributed 50 REP, and offered 10% fee (5 REP on top).

Bob contributed 10 REP, and offered 8% fee (0.8 REP on top).

During dispute, pool managed to get only 30 REP into the dispute round.

Since not all REP got in, we need to choose lowest possible fee that will ensure people who offered more than that fee, get in. The lowest possible fee is 10%.

Alice can get 20 dispute tokens, and refund of 88 REP. She was charged 10% fee (2 REP) for her dispute tokens.

Eve can get 10 dispute tokens, and refund of 44 REP. She was charged 10% fee (1 REP) for her dispute tokens.

Bob can get 0 dispute tokens, and refund of 10.8 REP. He did not get into the round.

3 REP are collected in fees.

## Example 3

John contributed 100 REP, and offered 20% fee (20 REP on top).

Alice contributed 100 REP, and offered 10% fee (10 REP on top).

Eve contributed 50 REP, and offered 5% fee (2.5 REP on top).

Bob contributed 10 REP, and offered 5% fee (0.5 REP on top).

During dispute, pool managed to get only 200 REP into the dispute round.

Since not all REP got in, we need to choose lowest possible fee that will ensure people who offered more than that fee, get in. The lowest possible fee is 5%.

John can get 100 dispute tokens, and refund of 10 REP. He was charged 10% fee (10 REP) for his dispute tokens.

Alice can get 100 dispute tokens, and refund of 0 REP. She was charged 10% fee (10 REP) for her dispute tokens.

Eve can get 0 dispute tokens, and refund of 52.5 REP. She did not get into the round.

Bob can get 0 dispute tokens, and refund of 10.5 REP. He did not get into the round.

20 REP are collected in fees.

Note that John was charged 10% fee, even though he offered 20%.

# Game theory

It is most optimal for particpants to offer the fee that their consider fair market value. They will be charged less if there is no competition, and they will be charged 0% if the pool does not fill.

For any risk-neutral disputer who considers to dispute on their own, it is always more beneficial to be part of the pool instead. Proof follows.

Consider disputer Alice who thinks dispute tokens will be worth `FAIR_PRICE` REP, and she is risk-neutral. She wants to participate using 1 REP (for simplicity, though proof will hold with other amounts)

If she disputes on her own, she has two possibilities:

- She does get the transaction in, and makes `FAIR_PRICE - 1` REP in profit
- She does not get in, and makes nothing in profit

Now, consider if she was member of the pool (she would place her contribution with fee `FAIR_PRICE - 1`):

- She does get the transaction for the pool in (at least one REP from pool was used for dispute):
  - ...but someone has bid higher, so they get the dispute tokens. In that case Alice charges everyone in the pool at least `FAIR_PRICE - 1` fee. So she will receive in fees at least `(FAIR_PRICE - 1) * AMOUNT_FROM_POOL_THAT_PARTICIPATED`. That is at least `FAIR_PRICE - 1` profit in fees, and will be higher if more than one REP from pool participates, or if the actual fee is higher than `FAIR_PRICE - 1`.
  - ...and not enough people bid higher, so she gets one dispute token, and is charged some fee `ACTUAL_FEE`. Her profit as contributor is `FAIR_PRICE - 1 - ACTUAL_FEE`. She also charges in fees `ACTUAL_FEE * AMOUNT_FROM_POOL_THAT_PARTICIPATED`. So her total profit is `FAIR_PRICE - 1 + ACTUAL_FEE * (AMOUNT_FROM_POOL_THAT_PARTICIPATED - 1)`. This is alt least `FAIR_PRICE - 1`, and is more if she wasn't the only participant that got in.
- She does not get her transaction in:
  - ...but someone else got the pool in, and her contribution got in. She gets `FAIR_PRICE - 1 - ACTUAL_FEE` profit, which is at least `0`, which is neutral for her. But she may get more profit if the actual fee turns out lower.
  - ...but someone else got the pool in, but her contribution didn't get in. She gets full refund, and makes no profit.

If we compare scenarios between participanting on her own, and in a pool, it is evident that participating in the pool is at least not worse, and in many cases is better. This analysis omitted the fact that she will receive only 90% of fees. If we take that into account, she may get slightly worse results by participating in the pool, but only if she is dominant participant of the pool (i.e. contributes more than 90% of pool).

# Gas costs

## Dispute without pool

- [First TX](https://etherscan.io/tx/0x602a90e0984603759c2f503d2af1f2524154c9f9e5e408fa57ee04c99694a30b), creates crowdsourcer, 1.23M gas
- [Subsequent TX](https://etherscan.io/tx/0x41d226c35bdf43b5ff3982f7629047c171544aebcf6ca2babf01b7d4f5c752a1), 344k gas
- [Last TX](https://etherscan.io/tx/0xd15819ddbcb3885bdeef47dadc8bc88a020b5b019ea72ac84191fcb7f9543907), creates next fee window, cleans stuff up, 3.92M gas
- [Failed, sent too late](https://etherscan.io/tx/0xb343fec3bebc54169b8d60f0339e52b552476f766120245ad9f99711d42d1b5e), 42k

## Dispute with pool

- [Successful dispute transaction, not first contribution](https://etherscan.io/tx/0x8f6db8c42ebf8befcf9edae24d75ee9d5b99ac4aea13e4e232ff99fe25194a8a), 431k gas
- [Failed dispute, triggered too soon](https://etherscan.io/tx/0x5fc11a2ff27a14460fb47122570c5aabddc9c6b7e9a67f1256d4f5b0445cb888), 24k gas
- [Successful dispute transaction, first contribution](https://etherscan.io/tx/0xb8372673e2834c7af0067b52bc4d6d07adc928da9ae740784658bc562282bdd4), 1.078M gas

# Verify on etherscan

- `for file in build/contracts/*.json; do echo $file "https://etherscan.io/verifyContract2?a="$(cat $file | jq -r '.networks["1"].address') $(d yarn truffle-flattener $(find contracts -name $(basename $file | sed 's/json/sol/g') ) | nc termbin.com 9999); done | grep -v null`
