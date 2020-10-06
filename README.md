# Near Account Keys and Auth Middleware

## Submission for NEAR 🌈 Hackathon by [@theophoric](https://github.com/theophoric)

*NOTE TO REVIEWERS*

This readme has been updated but the code has not been modified.  The commit immediately prior to the end of the hackathon can be found [here](https://github.com/theophoric/near-auth-as/tree/06b5a5aed7770413b332d275be26dcbe9bff4227).

As of 10/6 I am still updating this readme and intend to have a video walkthrough / demo uploaded by EOD.  

---

## tl;dr

> "Contract code for creating and authenticating `AccountKey`s: programmable `AccessKey`s at the application level; exposed as a proxy/standalone contract or through import, as demonstrated through two integration examples"

- contracts:
  - `auth` 
    - main contract for submission
    - can be used as an authentication middleware piece or as a standalone token manager
    - methods are _not_ protected
    - [code](/contracts/auth/main.ts)
    - contract compiles to `out/auth.wasm`
  - `greeter`
    - basic integration example, based on "Near Greeter" boilerplate contract
    - all methods are protected
    - exposes token creation methods
    - [code](/contracts/greeter/main.ts')
    - contract compiles to `out/greeter.wasm`
    - deploy auth standlone: `near deploy out/auth.wasm --initFunction init --initArgs "{}"`
  - `account`
    - more advanced intgration example, contract that exposes `Action` types as contract methods
    - all methods are protected
    - exposes token creation methods
    - [code](/contracts/account/main.ts)
    - contract compiles to `out/account.wasm`
  - `auth_proxy`
    - proxy authority integration example
    - [code](/contracts/proxy_auth/main.ts)
    - INCOMPLETE :: I had compile errors before submission so I just commented the code out.
- build: `yarn build`
  - compiles the examples in following to `out/`:
    - `auth.wasm` :: standalone auth instance.  Can be used as an authentication proxy, or to test out account key creation.  contract methods are _not_ protected
- deploy
  - auth standalone/proxy: `near deploy out/auth.wasm --initFunction init --initArgs "{}"`
  - greeter example: `near deploy out/greeter.wasm --initFunction init --initArgs "{}"`
  - account example: `near deploy out/account.wasm --initFunction init --initArgs "{}"`

---

## What?

Introduces `AccountKey` as a mechanism for exposing `AccessKeys` at the application level.  The basic idea is to treat `context.predecessor` as an unforgable signature of the invoking account context on the message, and to use this as a basis for allowing actions within the context.  Each `AccountKey` maintained in contract storage has a corresponding `AccessKey` in which the `publicKey` is derived from the `AccountId` of the permitted predecessor.  

This allows for highly programmable (single use, revokable, expirable) -- and portable (transferrable, transferrable within a range)  -- access keys.  Morover, an an ecosystem of many accounts that support this scheme (e.g. all accounts inheriting from `nft.near` ), with no non-account `AccessKeys`, would be totally auditable from outside the contract scope (e.g. can reason about security by viewing reachability of certain functions or accounts).

Also allows for object capability patters like attenuated or revokable forwarders, and capability purses (account as a bag of keys).


## Why?

TODO 

- dangerous and complex to have each contract manage its own authentication; and no way to reason about security from outside the application layer.
- move toward composable, modular, reusable function components; access tokens and digital rights


## How?


The core component of `Auth` is the `AccessToken`, defined in brief below:

```ts
@nearBindgen
export class AccountKey {
  account: AccountId;
  allowance: u128;
  allowedFunctions: Set < FunctionName > ;
  receiverID: AccountId;
  // ...
  has_auth(amount: Amount, fn: FunctionName): bool {
    if ((amount > u128.Zero) && // requested amount > 0
      (this.allowance > u128.Zero) && // allowance not unlimited
      (amount > this.allowance)) { // reqested amount excedes allowend
      return false
    } else {
      return this.allowedFunctions.has(ANY_FN) ||
        this.allowedFunctions.has(fn)
    }
  }
  // ...
  get_pk(): Uint8Array {
    return account_id_to_pk(this.account)
  }
  // ...
}

```

An `AccessKey` is created for every `AccountKey`, deriving the `PublicKey` from the `AccountId` of the receiver.

For example, an `AccountKey` registered for `theophoric.nameservice.testnet` would be replaced by `ACCKEYX{difficulty}X{left_pad_to_44}theophoricPnameservicePtestnet`, where difficulty is an adjustable number of `X`'s that worst-case accounts need to be prefixed, and the `left_pad_to_44` is just padding of `X`'s to make the length 44.  The assumption is that it is very difficult to generate a key that would resolve to a base58 public key with some fixed preset (e.g. someone could generate addresses until they find an address that has that prefix, and then register that account); generating the key for a specific account address would be _much_ harder.  The only downside to having a higher difficulty rating is that it limits the length of the names of accounts that can receive keys.



`auth` exposes a middleware function that gets invoked during every protected function call:

```ts

// authorize invocation of protected function
export function check(fn: FunctionName): void {
  _check_access(fn)
}

function _check_access(fn: FunctionName): void {
  // skip check if the invoker is self / "root reference"
  // this is the case if an access key is used or if invoked during initial contract creation scope.
  if (_caller_is_root()) return

  // make sure auth has been setup for this contract
  assert(_is_auth_init(), ERR_AUTH_NOT_INITIALIZED)

  // check that function name is in register of protected functions
  assert(protectedFunctions.has(fn), ERR_INVALID_FUNCTION)

  const caller = context.predecessor

  // make sure that caller has some authority
  assert(accountKeys.contains(caller), ERR_ACCOUNT_UNAUTHORIZED)

  const key = < AccountKey > accountKeys.getSome(caller)
  assert(key.has_auth(u128.Zero, fn), ERR_ACCOUNT_UNAUTHORIZED)
  logging.log("🔓 :: method " + fn + " authorized for " + key.account)
}
```

A key thing to note here is that the actual `AccessKey` is not referenced for authentication; it is only used as an external indicator of the permissions granted with `AccountKey`


See usage in this modified `greeter` contract:

```ts
// Make a list of protected functions
const FN_GET_GREETING = "getGreeting"
const FN_SET_GREETING = "setGreeting"
const AUTH_INIT_FNS = [FN_GET_GREETING, FN_SET_GREETING]

export function init(): void {
  // register auth component with list of protected functions
  auth.init(AUTH_INIT_FNS)

  // optionally, create some account tokens
  auth.add_account_key(context.predecessor, u128.Zero, [auth.ANY_FN]) // create "root" ; auth.ANY_FN == "*"
  auth.add_account_key("getter.greeting.testnet", u128.Zero, [FN_GET_GREETING] ) // create "getter" proxy 
  auth.add_account_key("setter.greeting.testnet", u128.Zero, [FN_SET_GREETING] ) // create "setter" proxy 
}

export function getGreeting(accountId: string): string | null {
  auth.check(FN_GET_GREETING) // Authenticate request
  return storage.get<string>(accountId, DEFAULT_MESSAGE);
}

export function setGreeting(message: string): void {
  auth.check(FN_SET_GREETING) // Authenticate Request
  const account_id = context.sender;
  logging.log(
    'Saving greeting "' + message + '" for account "' + account_id + '"'
  );
  storage.set(account_id, message);

```


## Usage


As proxy :  this option is only partially supported at present but the idea is that instead of installing auth in every contract it can be used as remote authority.

e.g. 


### Auth standalone

```ts

```

### Greeter Example

`
See usage examples in `contracts/account` and `contracts/greeter`

## build instructions

Run `yarn build` > outputs to `out/*.wasm`


## next steps

- add "whitelist" account option using blank account id
  - the corresponding public key would be `ACCKEYXXXXXXX....XXXXXX` 
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



