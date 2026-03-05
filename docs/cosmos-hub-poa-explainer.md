# Proof of Authority on Cosmos: What It Is, How It Works, and Why It Matters

**Source analyzed:** `cosmos/cosmos-sdk` — `enterprise/poa` module (proto, keeper, simapp, api)
**License:** Source Available Evaluation License (not Apache 2.0 — commercial use requires separate agreement)
**Status:** Active development, enterprise tier, SDK v0.54.x+

---

## The Simple Version

Most blockchains decide who gets to validate transactions through a competition. In Proof of Stake, you lock up tokens — the more you stake, the more influence you get. In Proof of Work, you buy mining hardware and burn electricity.

Proof of Authority (PoA) skips all of that.

Instead of a competition, there is a list. One administrator — a person, a company, a multisig wallet, or a governance contract — decides exactly who the validators are and how much weight each one carries. You get on the list by being chosen. You get removed by being removed. No tokens required. No hardware race.

That is the whole model.

---

## Why Build This?

The Cosmos SDK was designed primarily for open, permissionless networks. But a large class of real-world blockchain use cases does not need that. They need control:

- A consortium of banks running a shared settlement chain
- A company running an internal ledger
- A government issuing a regulated digital currency
- A developer environment where you want predictable, fast block production without the overhead of staking

For all of these, PoA is the right model. The Cosmos SDK PoA module is the official, production-grade implementation of that model — now shipped as part of the enterprise tier.

---

## How a Validator Gets Added

The process has two steps, and both must happen before anyone can participate.

**Step 1: Self-registration.**
Anyone with a funded wallet can register as a candidate validator. They submit their public key and some metadata (a name, a description, an operator address). When this transaction goes through, their power is set to zero. They are in the system but completely inactive. They cannot produce blocks or earn fees.

**Step 2: Admin activation.**
The administrator sends a second transaction that sets this validator's power to a specific number — say, 10,000. The moment that lands on-chain, the validator is live. At the end of that block, the blockchain's consensus engine receives the update and the validator starts participating in the next block.

To remove a validator, the admin sets their power to zero. Same mechanism, opposite direction. It takes effect immediately at end of block.

---

## The Admin: Who Is It?

The module stores exactly one admin address. That address is the only one that can change validator powers or update module parameters.

But "admin address" does not have to mean one person. In practice it is typically set to one of:

- A **multisig wallet** — requiring M-of-N signers to agree on any change
- A **governance module address** — meaning validator changes go through a proposal and vote first
- A **group account** — a DAO-like structure built into the SDK

This makes the model flexible. A small internal chain might have a single operator as admin. A regulated consortium chain might require 5 of 8 member institutions to sign off. The code does not care — it just checks that the transaction is signed by whoever the admin address currently is.

---

## How Power Works

Every active validator has an integer power value. The code stores validators indexed by power in descending order, so the highest-power validators are always at the top of the list.

Power does two things:

1. **Determines block-signing weight.** A validator with 20,000 power has twice the consensus influence of one with 10,000. This directly affects which validators can finalize blocks.

2. **Determines fee share.** Transaction fees are split proportionally by power. If you hold 30% of total network power, you earn 30% of fees.

Zero power means completely inactive — no block production, no fees, not counted in any governance vote.

---

## How Fees Flow

Every transaction on the chain pays a fee. Those fees accumulate in a system-level account called the Fee Collector.

The PoA module tracks what each validator is owed using a process called checkpointing. Whenever validator powers change — or before any withdrawal — the module calculates each validator's share of unallocated fees using this formula:

```
validator_share = unallocated_fees × (validator_power / total_power)
```

It uses decimal precision internally, so fractional fee amounts are tracked accurately and never lost to rounding. When a validator is ready to collect, they send a `WithdrawFees` transaction and the fees transfer from the Fee Collector to their operator wallet.

The key design choice here: fees are tied to power, not to token stake. There are no tokens being locked up, no staking rewards in the traditional sense. Validators earn by doing their job — running nodes — and the admin sets how much weight each one has.

---

## Governance: Validators Only

The PoA module locks down the governance system. Only active PoA validators (power > 0) can:

- Submit a governance proposal
- Deposit on a proposal
- Vote on a proposal

Regular token holders, if they exist on the chain, cannot participate in governance at all. The module installs hooks into the governance system that check every incoming action against the validator list before allowing it through.

When votes are counted, the standard staking-based tallying is replaced entirely. Instead of counting bonded tokens, the system counts validator power. A validator with 15,000 power has 1.5× the voting weight of one with 10,000. Validators that did not vote are not counted toward the participation threshold — only those who actually cast a vote contribute to the total.

This creates a clean governance model: the people running the network are the people making the decisions, weighted by how much responsibility they carry in the system.

---

## Technical State (What the Code Actually Shows)

Reading across all the source files:

| Component | What it does |
|---|---|
| `proto/cosmos/poa/v1/poa.proto` | Defines the core data: `Validator` (pubkey, power, metadata, fees), `Params` (admin address), `GenesisState` |
| `proto/.../tx.proto` | Four transactions: `UpdateParams`, `CreateValidator`, `UpdateValidators`, `WithdrawFees` |
| `proto/.../query.proto` | Five queries: params, single validator, all validators (paginated), withdrawable fees, total power |
| `keeper/keeper.go` | State storage — validators indexed by `(power, consensus_address)` for sorted iteration; secondary indexes by consensus address and operator address |
| `keeper/abci.go` | End-of-block hook — flushes queued validator power changes to CometBFT |
| `keeper/distribution.go` | Fee accounting — checkpoints, calculates shares, handles withdrawals |
| `keeper/governance.go` | Custom vote tallying — replaces staking keeper with power-based calculation; blocks non-validators |
| `keeper/msg_server.go` | Transaction handling — enforces admin-only access on `UpdateValidators` and `UpdateParams` |
| `simapp/app.go` | Reference app — shows minimal integration: Auth + Bank + Gov + POA, no staking module at all |

**Notable implementation details:**

- Validator updates are queued in a **transient store** (wiped every block) and flushed to CometBFT at end of block. Power changes take effect the following block.
- The module enforces that a validator's consensus key and operator key **must be different** — prevents accidentally using the same wallet for both signing roles.
- Secp256k1 keys are supported for consensus (unusual — normally only ed25519) via an optional flag, primarily for testing environments.
- Fee tracking uses `DecCoins` (decimal coins) to handle fractional amounts without rounding loss. The integer remainder is preserved on each withdrawal.
- The module replaces the entire staking keeper dependency in governance — chains using PoA do not need `x/staking` at all.

---

## Current Status

The PoA module lives under `enterprise/poa` in the main Cosmos SDK repository. It is:

- **Not Apache 2.0.** The license is a Source Available Evaluation License. Reading and evaluating the code is permitted. Running it in production commercially requires a separate agreement with Cosmos Labs.
- **Actively maintained** as of early 2026, tracking breaking changes in SDK v0.54.x.
- **Production-ready in design** — the code has comprehensive test coverage across all keeper files, genesis tests, distribution math tests, and governance hook tests.
- **Minimal by design** — the reference simapp wires together only five modules: Auth, Bank, Consensus, Governance, and POA. No staking, no distribution module, no slashing.

---

## The Bottom Line

PoA on Cosmos is a fully-formed enterprise blockchain primitive. It removes the open economic game of validator selection and replaces it with deliberate, admin-controlled authority. Validators are chosen, not elected. Fees are earned by contribution, not by capital. Governance is restricted to the people actually running the network.

For any chain that needs compliance, predictability, or consortium governance, PoA removes the complexity of staking while keeping all the benefits of the Cosmos SDK — IBC, modular governance, fast finality, and the full toolchain.

The code is clean, the architecture is straightforward, and it is shipping as an official Cosmos Labs enterprise module.
