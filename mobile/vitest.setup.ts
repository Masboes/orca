// Unit tests must never reach the network. The RPC client probes host
// reachability with fetch, so by default every request fails at once, like an
// unreachable host. A test that needs fetch stubs it explicitly.
function networkDisabledFetch(): Promise<never> {
  return Promise.reject(new Error('network disabled in unit tests; stub fetch explicitly'))
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, fetch: networkDisabledFetch })
