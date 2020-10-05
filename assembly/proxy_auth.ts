import {
  context, ContractPromise, storage
} from "near-sdk-as"

type AccountId = string
type FunctionName = string

const KEY_AUTHORITY = "proxy_authority"
const DEFAULT_GAS: u64 = 10_000_000_000_000;

export namespace ProxyAuth {

  export function init(authority: AccountId): void {
    storage.setString(KEY_AUTHORITY, authority)
  }

  export function can_call(account: AccountId, fn: FunctionName): bool {
    _proxy_can_call()
    return _on_proxy_can_call()
  }
  export function get_authority(): AccountId {
    return storage.getSome(KEY_AUTHORITY)
  }

  export function check(fn: FunctionName): void {
    assert(can_call(context.predecessor, fn), "✋ :: account not authorized")
  }
}

function _on_proxy_can_call(): bool {
  const promiseResponse = ContractPromise.getResults()
  assert(promiseResponse.length > 0, "BAD RESPONSE")
  const res = promiseResponse[0]
  if (res.status == 1) {
    const canCall = decode<bool>(res.buffer)
    return canCall
  } else return false
}

function _proxy_can_call(): ContractPromise {
  return ContractPromise.create(
    ProxyAuth.get_authority(),
    "can_call",
    {},
    DEFAULT_GAS
  )
}