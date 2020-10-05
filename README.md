# Near Authentication middleware and Account proxy
by @theophoric
> Note :: I'm down to the wire on this submission so there is _minimal_ documentation, testing, presentation, etc.  That said the code works* (sort of, issues with gas limits) and there's a couple of examples to show how it works.  I intend to continue working on this project and have lots of plans for it.  

tldr; check out [auth](/contracts/auth/main.ts) and [account](/contracts/account/main.ts)

## What?

Authentication middleware for near contracts.  Programmable, secure* `AccessKeys` at the application level.

## Why?

- from outside the system no way to reason about access patterns between contracts
- Composable realms in NEAR.
- capacity to reason about reachability and liveness of code and to build an access reference graph
- proper tokens-as-capabilities

## How it works

Middleware

## How to use it ?

Middleware component to check access, plus a 

See usage examples in `contracts/account` and `contracts/greeter`

## How are keys secured

The assumption is that the public keys are relatively unforgable

## What can be built with it 

Lots of cool things.

## build instructions

Run `yarn build` > outputs to `out/*.wasm`


## next steps


- graph rendering of account inheritance, access keys, and account keys 
  - visual representation of access graph
  - for subsets of accounts that use auth,
- encode properties into the keys 
  - burnable
  - transferable
  - expirable
  - 
  - revokable
  - consumable
    - single-use tokens 
- wildcard / child / descendant public keys
  - allows to say "anyone who has a wallet that was issued from this exchange can invoke this function" 
- fill function arguments
- single use or limited use tokens
  - e.g. issue a right to mint 10 tokens at some point in the future
- expiring keys
- generally opens the door for highly programmable keys



