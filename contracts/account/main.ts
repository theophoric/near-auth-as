
/////////////////////////////
// AUTH'd Account Contract //
/////////////////////////////


import { u128, context, ContractPromiseBatch, PersistentUnorderedMap, storage, logging, base58 } from 'near-sdk-as'
import * as auth from '../auth/main' // import auth middleware

// Types

type AccountId = string
type Amount = u128
type PublicKey = Uint8Array

// Errors

const ERR_CANNOT_DELETE_ACCOUNT_KEY = "Cannot delete an account access key using this method.  Try delete_account_key"

// AUTH stuff

// Until I figure out a clean way to get the function name from the runtime or function context need to do things like this.
const _FN_CREATE_ACCOUNT = "create_account"
const _FN_DEPLOY_CONTRACT = "deploy_contract"
const _FN_FUNCTION_CALL = "function_call"
const _FN_TRANSFER = "transfer"
const _FN_STAKE = "stake"
const _FN_ADD_KEY = "add_key"
const _FN_ADD_FULL_ACCESS_KEY = "add_full_access_key"
const _FN_DELETE_KEY = "delete_key"
const _FN_DELETE_ACCOUNT = "delete_account"
const _AUTH_INIT_FNS = [
  _FN_CREATE_ACCOUNT,
  _FN_DEPLOY_CONTRACT,
  _FN_FUNCTION_CALL,
  _FN_TRANSFER,
  _FN_STAKE,
  _FN_ADD_KEY,
  _FN_DELETE_KEY,
  _FN_DELETE_ACCOUNT
]

// Expose account token functions

/** add account key
 * 
 * @param account account to grant key to 
 * @param allowance key allowance
 * @param allowedFns key allowed functions; "*" is wildcard.
 */
export function add_account_key(account: string, allowance: u128, allowedFns: string[]): void {
  auth.check(auth.FN_ADD_ACCOUNT_KEY)
  auth.add_account_key(account, allowance, allowedFns)
}
  
/**
 * 
 * @param account account to remove key from
 */
export function remove_account_key(account: auth.AccountId): void {
  auth.check(auth.FN_REMOVE_ACCOUNT_KEY)
  auth.remove_account_key(account)
}

/**
 * burn account key of sender (requires account key)
 * useful for "sealing" an account
 */
export function burn_account_key(): void {
  auth.check(auth.FN_BURN_KEY)
  auth.burn_account_key()
}

/**
 * check if account can invoke a function
 * @param account 
 * @param fn 
 */
export function can_call(account: AccountId, fn: string): bool {
  return auth.can_call(account, fn)
}

/** 
 * get key for an account, if it exists
 * @param account 
 */
export function get_account_key(account: AccountId): auth.AccountKey {
  return auth.get_account_key(account)
}

/**
 * get a list of protected / auth'd functions
 */
export function get_protected_functions(): string[] {
  return auth.get_protected_functions()
}

// Storage

// const _KEY_ACCOUNT_BINARY = "account_binary"
// // child accounts should get account binary ; can load them with different code later on
// function _get_account_binary(): Uint8Array {
//   return <Uint8Array>storage.getBytes(_KEY_ACCOUNT_BINARY)
// }

// TODO :: add binary registry
// export function init(accountBinary:Uint8Array): void {
//   storage.setBytes(_KEY_ACCOUNT_BINARY, accountBinary) // TODO :: use a registry instead
export function init(): void {
  auth.init(_AUTH_INIT_FNS) // this ensures that contract is only initialized during its creation -- or if there's a full key somewhere.
  add_account_key(context.predecessor, u128.Zero, [auth.ANY_FN])
  logging.log("🎬 :: account contract initialized")
}

/**
 * Create sub account and send deposit
 *  TODO :: and deploy "account" >> this is necessary in order to install account key on it.
 * @param name 
 */
export function create_account(name: AccountId): void {
  auth.check(_FN_CREATE_ACCOUNT)
  // will fail if the contract name is not a valid child

  ContractPromiseBatch
    .create(name)
    .create_account()
    .transfer(context.attachedDeposit)
  // TODO ::
    // .deploy_contract(_get_account_binary())
    // .init(registry, accountBin)
    // .add_account_token(context.contractName)
  
  logging.log("🐣 :: account created "+ name)
}

/**
 * 
 * @param account 
 * @param amount 
 */
export function transfer(account: AccountId, amount: Amount): void {
  auth.check(_FN_TRANSFER)

  ContractPromiseBatch
    .create(account)
    .transfer(amount)
  logging.log("📦 :: transferred " + amount.toString() + " to " + account)
}

/**
 * deploy conract to self 
 * NOTE :: this can brick the contract .. watch out.
 * @param bin 
 */
export function deploy_contract(bin: Uint8Array): void {
  auth.check(_FN_DEPLOY_CONTRACT)

  ContractPromiseBatch
    .create(context.contractName)
    .deploy_contract(bin)
  //.function_call( ... ) is this possible ?  call a function on self, once code has expired ? todo :: test
}

/**
 * 
 * @param amount 
 * @param publicKey 
 */
export function stake(amount: Amount, publicKey: PublicKey): void {
  auth.check(_FN_STAKE)

  ContractPromiseBatch
    .create(context.contractName)
    .stake(amount, publicKey)
  logging.log("🥩 :: steaked " + amount.toString() + " to " + base58.encode(publicKey))
}

/**
 * 
 * @param publicKey 
 * @param allowance 
 * @param receiverId 
 * @param methodNames 
 */
export function add_access_key(publicKey: Uint8Array, allowance: Amount, receiverId: AccountId, methodNames: string[]): void {
  auth.check(_FN_ADD_KEY)

  ContractPromiseBatch
    .create(context.contractName)
    .add_access_key(
      publicKey,
      allowance,
      receiverId,
      methodNames
  )
  logging.log("🗝 :: added access key for " + base58.encode(publicKey))
} 

/**
 * 
 * @param publicKey 
 */
export function add_full_access_key(publicKey: PublicKey): void {
  auth.check(_FN_ADD_FULL_ACCESS_KEY)

  ContractPromiseBatch
    .create(context.contractName)
    .add_full_access_key(publicKey)
  logging.log("🗝 :: added full access key for " + base58.encode(publicKey))
}

/**
 * 
 * @param publicKey 
 */
export function delete_key(publicKey: Uint8Array): void {
  auth.check(_FN_DELETE_ACCOUNT)

  // Can't delete account keys this way
  assert(!auth.pk_is_account_key(publicKey), ERR_CANNOT_DELETE_ACCOUNT_KEY)

  ContractPromiseBatch
    .create(context.contractName)
    .delete_key(publicKey)
  logging.log("🔐 :: removed access key for " + base58.encode(publicKey))
}

/**
 * 
 * @param beneficiaryId 
 */
export function delete_account(beneficiaryId: AccountId): void {
  auth.check(_FN_DELETE_ACCOUNT)

  ContractPromiseBatch
    .create(context.contractName)
    .delete_account(beneficiaryId)
  
  logging.log("☠️ :: good bye. funds go to "+ beneficiaryId)
}

