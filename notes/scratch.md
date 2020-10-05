# scratch for auth

consider: access_token | action_token .. ?

"value" of an account_token is that it can accumulate capabilities.

So .. the account_token / purse has an owner .. as designated by the access_token 


question :: is there any issue with assigning _whatever_ to the public_key ?  it's just an account vector .. 

The main issue .. is that shorter keys are easier to forge.  The solution is to pad the input.

q: what is the length of the public key ?  what is the base? 

I think.. it's 32-byte base 58 .. confirm.


`acce55_c0de::_______________________________<account_id>`

So, can use _any_ string, 42 characters.

one idea .. is to use _UPPER CASE_ deliminators in place of the `dot`'s 

e.g. `space.testnet` becomes `spaceXtestnet`

`TOKEN

ISSUES :: account names can include _invalid_ base58 characters, such as "1" and `"0"`

what to do ?
- reject these accounts
  - bad
- replace with e.g. ONE or ZERO
  - and then replace "dot"` with DOT
- replace with upper case alpha character
  - `.` -> `DOT` / `D` or `POINT` / `P`
  - `-` -> `Dash` / `D` or `Hyphen` / `H`
  - `_` -> `UNDERSCORE` / `U`
  - `0` -> `O`
  - `l` -> `L`


"TOKEN" + "XXXXXXXXXXXXX" (left-padded with 1 or more "X"'s) + ACCOUNT_ID

TOKENX = 6

communicable access tokens ::

AUTH controller (`<XXX>.auth.testnet`)


Transfer a token from one owner to another

`transfer_access_token`
`mint_access_token`
`burn_access_token`  :: 
`revoke_access_token` :: separate action from burn -- 

consider :: allowing for `revoke_access_token(<token_id>)` as the method name
  ^> an issue here .. is that there is not presently a way of identifying access tokens .. 

another problem :: access tokens are keyed by <sender_address> 
Consider :: enforcing a <nonce|index> in the access token .. this would allow for the following:

- multiple access tokens for a single sender ;; (is this already the case .. ? yes.)

new format: `TOKEN` (prefix) + `asdcx28` base58-encoded ID + `XXXXXX` (buffer) + '

actually.. there is _already_ a nonce.  what about deletions ? 
ok .. so I think this doesn't matter .. or, is not exposed to the sdk.

which means .. that there needs to be 

concept :: the `AUTH_CONTROLLER`  .. can issue a 

ok .. so then need to pad with "1"'s 

nonce storage "last id"

So ..  a couple issues .. mainly around the storage structures .

say that every token created gets a nonce, and that the nonce is always incrementing.  
the nonce can then be used to reference the token.
however, it's also important to be able to retrieve a list of acess tokens based on an account (sender)'s id.  Mainly this is for efficient authentication of requests:
  e.g. auth(action, args, predescessor) => pred => method => args

Match on any of the following ::
`pred`
`method(s)`
`args(s)`

match first on specific, then on general.

e.g. "ANYONE" can do "make_mint" with 0 as args.


The other approach .. and perhaps the one I should be taking .. is that access keys are indexed by the public key -- in this case that means the formatted account id -- and that maps to either FULL_ACCESS or an array of methods that the sender (pk) is allowed to call.  
this has a few benefits:
- simplicity
  - can easily look up permissions



note on "public actions" -- a public action can just be an empty pk / account --> then the function call would all of the available methods.

to get the permissions of a given account / sender : 

get public key
see if there's a matching token, see if method matches
  else see if there's a public access key
    see if any method matches

public key is `TOKENXXXXXXXXXXXXXXXXXXX`




-----

Okey that seems like it should work.  Now a more complicated point ::

The "tokens" / AccountKeys (I think this is a better name)

TKNKEY
ACCKEY

Whereas account keys grant access to the local context, token keys .. are outgoing .. 

how would this work .. ?

What is desired .. is to have a transferrable version of the token.  So.. perhaps .. could "mint" a token.  and initially, that token is a self-referenced permission >> but when that token leaves .. it becomes a remote reference ..

This could be accomplished with vats >> so basically, an account would grant a vat some set of actions .. then the vat would "mint" tokens that could be traded around .. basically, a claim that the vat will call some function on the target.

A simple version of this .. is that there are 2 access keys created for every token -- one for the sender, one for the receiver.  

so .. tokens represent an afforded access .. 
how would it work? / restrictions .. 

could only send it between vats.

each one would be a kind of pointer .. 


-------------------

A second desiderata is that the access tokens .. are transferrable

AccountKey
TokenKey TKNKEY >> is _outgoing_ .. it can only be created by 

AccessToken :: has a distribution range.  e.g. within a given "space" 
this space .. can be encoded into the token..  e.g. TKN112XXXXXXspaceDtestnet means that it can only be transmitted to / from accounts that inherit from `space.testnet`

NOTE :: I think this is too confusing to deal with right now.

-------------------

inherited / family keys

Using Wildcard
`WDspacePtestnet` :: children and all descendants of `space.testnet` can use this access key // W == "Wildcard"
`WDtestnet` :: siblings of `space.testnet` can use this access key`

using child / descendent
`SspacePtestnet` children of space
`DspacePtestnet` account key applies to all descendants of D




`IDspaceDtestnet


-------------------

What is the structure ? 

AccessKey: {
  public_key
  permission: FullAccess | FunctionCall([]method_name)
}


methods 
```ts

in init(), register the auth

_auth_init([]registered_function_names)
  ^> add each one to `protectedFunctionRegister`


add_full_account_key_key(pk) // the same as "add_function_account_key(*)"
add_function_account_key(pk, allowence, []functionNames)
remove_account_key(pk)

add_account_key(pk, allowence, receiver_id, functionNames[]) // allowence 0 = unlimited, funnctinName="*" => full access


can_call(method, account): bool

```








delete_access_key(pk) // delete full or function key


















so, 

```ts

const REPLACE_DOT = [".","D"]
const REPLACE_HYPHEN = ["-","H"]
const REPLACE_UNDERSCORE = ["_","U"]
const REPLACE_ZERO = ["0","O"]
const REPLACE_L = ["l", "L"]


const PK_LENGTH = 44
const PK_PREFIX = "TOKEN"
const PK_PAD_CHAR = "X"
const PK_MAX_ACCOUNT_LENGTH = 38 // have at least one "X" at the start 



function _account_id_to_pk(account: string): string {
  // requre that account is < 38 characters
  assert(account.length <= MAX_ACCOUNT_LENGTH_FOR_PK, "Account must be less than" + MAX_ACCOUNT_LENGTH + "characters long" )
  
  const formatted = account
    .replaceAll(...REPLACE_DOT)
    .replaceAll(...REPLACE_HYPHEN)
    .replaceAll(...REPLACE_UNDERSCORE)
    .replaceAll(...REPLACE_ZERO)
    .replaceAll(...REPLACE_L)

  const padded = formatted.padStart(PK_LENGTH - PK_PREFIX.length, PK_PAD_CHAR)

  const pk = PK_PREFIX + padded

  return pk
}

function _pk_to_account_id(pk: string): string {
  assert(pk.startsWith(PK_PREFIX), "INVALID PK FORMAT")

  const accountID = pk
    .substring(PK_PREFIX.length)
    .replaceAll(PK_PAD_CHAR, "")
    .replaceAll(...REPLACE_DOT.reverse())
    .replaceAll(...REPLACE_HYPHEN.reverse())
    .replaceAll(...REPLACE_UNDERSCORE.reverse())
    .replaceAll(...REPLACE_ZERO.reverse())
    .replaceAll(...REPLACE_L.reverse())

  return accountID
  // remove prefix
  // remove "X"'s
  // reverse replacements

}

```

