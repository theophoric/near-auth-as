///////////////////////////
// AUTH / Account Tokens //
///////////////////////////



import {
  base58,
  u128,
  context,
  PersistentMap,
  PersistentSet,
  ContractPromiseBatch,
  logging,
  storage
} from 'near-sdk-as'

/////////////
// STORAGE //
/////////////

// Keys

const KEY_PROTECTED_FUNCTION_SET = "p"
const KEY_ACCOUNT_KEYS_MAP = "k"
const KEY_AUTH_INIT = "auth_init"
// Registers

const protectedFunctions = new PersistentSet < FunctionName > (KEY_PROTECTED_FUNCTION_SET)
const accountKeys = new PersistentMap < AccountId,
  AccountKey > (KEY_ACCOUNT_KEYS_MAP)

// Getters and Setters

function _is_auth_init(): bool {
  return storage.getPrimitive < bool > (KEY_AUTH_INIT, false)
}


///////////
// TYPES //
///////////

export type FunctionName = string
export type AccountId = string
export type Amount = u128

@nearBindgen
export class AccountKey {
  account: AccountId;
  allowance: u128;
  allowedFunctions: Set < FunctionName > ;
  receiverID: AccountId;
  // revokable: bool; 
  /**
   * 
   * @param account owner of access key
   * @param allowance amount access key can spend (not implemented)
   * @param allowedFunctions functions that access key is allowed to invoke
   */
  constructor(account: AccountId, allowance: Amount, allowedFunctions: Set < FunctionName > ) {
    // allowed function set is either ["*"] or consists of function names registered during init    

    this.account = account
    this.allowance = allowance
    this.allowedFunctions = allowedFunctions
    this.receiverID = context.contractName // for now.
  }
  /**
   * return the base58 encoding of associated public key
   */
  get_pk(): string {
    return account_id_to_pk(this.account)
  }
  // /**
  //  * let list of allowed functions
  //  * substitutes "*" for function names
  //  */
  // get_allowed_functions(): FunctionName[] {
  //   let allowedFunctions = this.allowedFunctions.values()
  //   if (allowedFunctions.length > 0 && allowedFunctions[0] == ANY_FN) {
  //     allowedFunctions = get_protected_functions()
  //   }
  //   return allowedFunctions
  // }
  /** checks if this acces key can invoke some function + amount
   * 
   * @param amount amount being spent
   * @param fn function being called
   */
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
  /**
   * json- encoded string representation of access key
   */
  toString(): string {
    return '{ "account": "' + this.account + '", "allowance": "' + this.allowance.toString() + '", "allowed_functions": "' + this.allowedFunctions.values() + '"}'
  }
}


// Error Codes

export const ERR_INVALID_FUNCTION = "Invalid function"
export const ERR_ACCOUNT_UNAUTHORIZED = "The predecessor of this action is not authorized to invoke this function"
export const ERR_NO_KEY = "No account key exists for this account"
export const ERR_AUTH_NOT_INITIALIZED = "auth has not been initialized for this contract"

// Constant Values

export const ANY_FN = "*"

// Function Names for auth

export const FN_INIT = "init"
export const FN_ADD_ACCOUNT_KEY = "add_account_key"
export const FN_REMOVE_ACCOUNT_KEY = "remove_account_key"
export const FN_BURN_KEY = "burn_account_key"

const _AUTH_INIT_FNS = [FN_INIT, FN_ADD_ACCOUNT_KEY, FN_REMOVE_ACCOUNT_KEY]


// Public Initialization functions

/** initialize auth module 
 * this can _only_be invoked within the original creation scope, or with a full key
 * @param protectedFns list of protected functions that will be authorized; 
 */
export function init(protectedFns: FunctionName[]): void {
  // easy solution :: "makeKey()" :: sender of the transaction gets a key
  _check_access(FN_INIT) // enforces that auth is set up during same transaction as original creation, when access scope is open. >> e.g. if created from within a function context, it must be processed in same promise block 
  _init_auth(_AUTH_INIT_FNS.concat(protectedFns)) // sets up protected functions; sets auth_init flag
}

// Assertion Helpers

/** `auth` checks if current action is valid for a particular function; throws error if not 
 * Meant to be used as a guard in contract actions.
//  * For non-assertion version, use the `can_call` method instead
 * @param fn function name to check against
 */
export function check(fn: FunctionName): void {
  _check_access(fn)
}

// Read Functions

/** get account key for account id, if it exists
 * 
 * @param account AccountId
 */
export function get_account_key(account: AccountId): AccountKey {
  return <AccountKey > accountKeys.getSome(account)
}

/**
 * get a list of registered (auth-able) functions
 */
export function get_protected_functions(): FunctionName[] {
  return <FunctionName[] > protectedFunctions.values()
}

/** can_call checks to see if a given predecessor 
 * This function can allow an external function to use this contract as an auth proxy
 * @param account accountID of predecessor that triggered / will trigger acction 
 * @param fn name of function being invoked
 */
export function can_call(account: AccountId, fn: FunctionName): bool {
  if (!accountKeys.contains(account)) return false
  const key = < AccountKey > accountKeys.get(account)
  return key.has_auth(u128.Zero, fn)
}

// Exported Write Functions

/**
 * 
 * @param account account to grant key
 * @param allowance amount that account is able to spend
 * @param allowedFns Array<string> of function names to allow; use "*" to allow all functions and "" (blank) to allow none (not useful until wildcards are implemented); allowed function names must be a member of get_protected_function_names() (registered during init)
 */
export function add_account_key(account: AccountId, allowance: Amount, allowedFns: FunctionName[]): void {
  // _check_access(FN_ADD_ACCOUNT_KEY) // authorize action

  // convert to set
  const allowedFnSet = new Set < FunctionName > ()
  for (let i = 0; i < allowedFns.length; i++) {
    allowedFnSet.add(allowedFns[i])
  }

  // helper function to check functions against registered ones
  const validFnSet = (fnSet: Set < FunctionName > ): bool => {
    const invalidFn = (fn: FunctionName, index: i32, arr: string[]): bool => {
      return fn !== ANY_FN ||
        !protectedFunctions.has(fn) // invalid if the name is not in the list of protected functions
    }
    const fnValues = fnSet.values()
    return fnValues.some(invalidFn)
  }
  assert(validFnSet(allowedFnSet), ERR_INVALID_FUNCTION)

  const accountKey = new AccountKey(account, allowance, allowedFnSet)
  _add_access_key_for_account_key(accountKey) // create access key on account

  // save to registers
  accountKeys.set(account, accountKey)
  logging.log('🔑 :: AccountKey added for "' + account + '" with methods: [' + allowedFns.toString() + ']')
  return
}

/** Remove account key
 * This will remove both the account-level key and the associated access key
 * 
 * @param account remove key for this account
 */
export function remove_account_key(account: AccountId): void {
  // _check_access(FN_REMOVE_ACCOUNT_KEY)
  const accountKey = accountKeys.getSome(account)
  _remove_access_key_for_account_key(accountKey)
  accountKeys.delete(account)
  logging.log("🔐:: AccountKey removed for " + account)
}

/**
 * Burns key used to auth
 * This can be used by a creator to revoke its own access
 */
export function burn_account_key(): void {
  // _check_access(FN_BURN_KEY)
  const accountKey = accountKeys.getSome(context.predecessor)
  _remove_access_key_for_account_key(accountKey)
  accountKeys.delete(accountKey.account)

  logging.log("🔥 :: AccountKey key burned for " + context.predecessor)
}


/////////////////////////
// TYPES AND CONSTANTS //
/////////////////////////


// Type Declarations


///////////////////////
// PRIVATE FUNCTIONS //
///////////////////////

// Private initialization functions

function _init_auth(protectedFns: FunctionName[]): void {
  // register all protected functions
  for (let i = 0; i < protectedFns.length; i++) {
    _add_protected_function(protectedFns[i])
  }
  storage.set(KEY_AUTH_INIT, true)
}

// Private assertion functions


// NOTE :: does _not_ protect balance, presently.
function _check_access(fn: FunctionName): void {
  // if caller is "root" (self) then allow anything // e.g. during initial invocation
  if (_caller_is_root()) return

  // make sure auth has been setup for this contract
  assert(_is_auth_init(), ERR_AUTH_NOT_INITIALIZED)


  // check that function name is in register
  assert(protectedFunctions.has(fn), ERR_INVALID_FUNCTION)

  const caller = context.predecessor
  // check account key for pred
  assert(accountKeys.contains(caller), ERR_ACCOUNT_UNAUTHORIZED)
  // assert
  const key = < AccountKey > accountKeys.getSome(caller)
  // how to deal with balance .. ?  is that a special case for transfer ? 
  assert(key.has_auth(u128.Zero, fn), ERR_ACCOUNT_UNAUTHORIZED)
  logging.log("🔓 :: method " + fn + " authorized for " + key.account)
}

// Private write functions

function _add_protected_function(fn: FunctionName): void {
  protectedFunctions.add(fn)
  logging.log("🔒 :: added protection for " + fn)
}

function _add_access_key_for_account_key(accountKey: AccountKey): void {
  const pk = accountKey.get_pk()
  if (accountKey.allowedFunctions.has(ANY_FN)) {
    // create full access key
    ContractPromiseBatch
      .create(context.contractName)
      .add_full_access_key(base58.decode(pk))
  } else {
    ContractPromiseBatch
      .create(context.contractName)
      .add_access_key(
        base58.decode(pk),
        accountKey.allowance,
        context.contractName,
        accountKey.allowedFunctions.values())
  }
}

function _remove_access_key_for_account_key(accountKey: AccountKey): void {
  const pk = accountKey.get_pk()
  ContractPromiseBatch
    .create(context.contractName)
    .delete_key(base58.decode(pk))
  accountKeys.delete(accountKey.account)
}

// Private helper functions

// check if action invoker is from own context ;; this only happens during initialization or with a valid full access key
function _caller_is_root(): bool {
  return context.predecessor == context.contractName
}

/////////////////////////////////////////
// ACCOUNT_ID to PUBLIC_KEY CONVERSION //
/////////////////////////////////////////

// TODO ::: export to different library

const _REPLACE_POINT = [".", "P"]
const _REPLACE_HYPHEN = ["-", "H"]
const _REPLACE_UNDERSCORE = ["_", "U"]
const _REPLACE_ZERO = ["0", "Z"]
const _REPLACE_L = ["l", "L"]


const _PK_NONCE_LENGTH = 3
const _PK_MAX_NONCE = 58 ^ _PK_NONCE_LENGTH // base 58 * length = 195112 
const _PK_NONCE_PAD_CHAR = "1" // zero
const _PK_LENGTH = 44 // public key length
const _PK_PREFIX = "ACCKEY" // change this ? 
const _PK_PAD_CHAR = "X" // used b/c not a valid 
const _PK_MAX_ACCOUNT_LENGTH = _PK_LENGTH - _PK_NONCE_LENGTH - _PK_PREFIX.length - 1 // have at least one "X" at the start 

// TODO :: add family / wildcard keys
// const _PK_DESCENDENT_CHAR = "D"
// const _PK_CHILD_CHAR = "C"

export const ERR_ACCOUNT_LENGTH = "Account must be less than" + _PK_MAX_ACCOUNT_LENGTH.toString() + "characters long"


// PK Helper Functions

/** convert an AccountID into a public key 
 * returns as string -- use base58.decode to get Uint8Array
 * 
 * @param account 
 */
export function account_id_to_pk(account: string): string {
  // requre that account is < 38 characters
  assert(account.length <= _PK_MAX_ACCOUNT_LENGTH, ERR_ACCOUNT_LENGTH)

  const formatted = account
    .replaceAll(_REPLACE_POINT[0], _REPLACE_POINT[1])
    .replaceAll(_REPLACE_HYPHEN[0], _REPLACE_HYPHEN[1])
    .replaceAll(_REPLACE_UNDERSCORE[0], _REPLACE_UNDERSCORE[1])
    .replaceAll(_REPLACE_ZERO[0], _REPLACE_ZERO[1])
    .replaceAll(_REPLACE_L[0], _REPLACE_L[1])

  const padded = formatted.padStart(_PK_LENGTH - _PK_PREFIX.length, _PK_PAD_CHAR)

  const pk = _PK_PREFIX + padded

  return pk
}

/** get the account id associated with an auth'd public key
 * 
 * @param pk base58 encoding of access key public key
 */
export function pk_to_account_id(pk: string): string {
  assert(pk.startsWith(_PK_PREFIX), "INVALID PK FORMAT")

  const accountID = pk
    .substring(_PK_PREFIX.length) // remove prefix
    .replaceAll(_PK_PAD_CHAR, "") // remove padding
    .replaceAll(_REPLACE_POINT[1], _REPLACE_POINT[0])
    .replaceAll(_REPLACE_HYPHEN[1], _REPLACE_HYPHEN[0])
    .replaceAll(_REPLACE_UNDERSCORE[1], _REPLACE_UNDERSCORE[0])
    .replaceAll(_REPLACE_ZERO[1], _REPLACE_ZERO[0])
    .replaceAll(_REPLACE_L[1], _REPLACE_L[0])

  return accountID
}
