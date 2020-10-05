import { context, logging, storage, u128 } from "near-sdk-as";
import * as auth from './auth/auth'
// import { check } from "./proxy_auth";


// AUTH STUFF GOES HERE
const FN_GET_GREETING = "getGreeting"
const FN_SET_GREETING = "setGreeting"
const AUTH_INIT_FNS = [FN_GET_GREETING, FN_SET_GREETING]

export function init(): void {
  auth.init(AUTH_INIT_FNS) // this ensures that contract is only initialized during its creation -- or if there's a full key somewhere.
  // add_account_key(context.predecessor, u128.Zero, [auth.ANY_FN])
}

export function add_account_key(account: string, allowance: u128, allowedFns: string[]): void {
  // auth.check(auth.FN_ADD_ACCOUNT_KEY)// note :: as currently configured 
  add_account_key(account, allowance, allowedFns)
}
  
export function remove_account_key(account: auth.AccountId): void {
  // auth.check(auth.FN_REMOVE_ACCOUNT_KEY)// note :: as currently configured 
  auth.remove_account_key(account)
}

export function burn_account_key(): void {
  // auth.check(auth.FN_BURN_KEY)// note :: as currently configured 
  burn_account_key()
}


const DEFAULT_MESSAGE = "Hello"

export function getGreeting(accountId: string): string | null {
  
  // Authenticate request
  auth.check(FN_GET_GREETING) 

  return storage.get<string>(accountId, DEFAULT_MESSAGE);
}

export function setGreeting(message: string): void {
  
  // Authenticate Request
  auth.check(FN_SET_GREETING) 
  
  const account_id = context.sender;
  logging.log(
    'Saving greeting "' + message + '" for account "' + account_id + '"'
  );
  storage.set(account_id, message);
}
