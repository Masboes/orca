import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connect } from './rpc-client'
import {
  REACHABILITY_PROBE_TIMEOUT_MS,
  REACHABILITY_WINDOW_MS,
  RpcReachabilityBurst,
  reachabilityUrl
} from './rpc-reachability-burst'

// After an Android phone wakes, its Tailscale tunnel can drop traffic for ~15s
// (tailscale#21650) and the client's dial sits in SYN backoff past the moment the
// path recovers. A cancellable probe once a second finds that moment so the
// client redials right away instead of waiting out a 12s dial and the ladder.

vi.mock('./e2ee', () => ({
  generateKeyPair: () => ({ publicKey: new Uint8Array(32), secretKey: new Uint8Array(32) }),
  deriveSharedKey: () => new Uint8Array(32),
  publicKeyFromBase64: () => new Uint8Array(32),
  publicKeyToBase64: () => 'client-public-key',
  encrypt: (plaintext: string) => `encrypted:${plaintext}`,
  decrypt: (raw: string) => raw.replace(/^encrypted:/, ''),
  decryptBytes: (bytes: Uint8Array) => bytes
}))

// Mirrors React Native's WebSocket: readyState only advances on a delivered event,
// and a dial that has not opened cannot be cancelled natively.
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readonly CONNECTING = 0
  readonly OPEN = 1

  readyState = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: ((event?: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event?: unknown) => void) | null = null
  deliversCloseEvent = true
  sent: string[] = []

  constructor(readonly endpoint: string) {
    sockets.push(this)
  }

  send(payload: string): void {
    this.sent.push(payload)
  }

  close(): void {
    if (this.readyState === MockWebSocket.CLOSED) {
      return
    }
    this.readyState = MockWebSocket.CLOSED
    if (this.deliversCloseEvent) {
      this.onclose?.({ code: 1006, wasClean: false })
    }
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  authenticate(): void {
    this.open()
    this.onmessage?.({ data: JSON.stringify({ type: 'e2ee_ready' }) })
    this.onmessage?.({ data: 'encrypted:{"type":"e2ee_authenticated"}' })
  }

  replyToProbe(): void {
    this.onmessage?.({ data: 'encrypted:{"id":"mobile-liveness-reply","ok":true,"result":{}}' })
  }
}

const sockets: MockWebSocket[] = []
const originalWebSocket = globalThis.WebSocket
const TAILSCALE_ENDPOINT = 'ws://100.84.12.9:6769'

// The network as the phone sees it: either the host answers HTTP at once or
// nothing comes back until the request is aborted.
let hostAnswers = false
let hostStatus = 200
const fetchCalls: { url: string; signal?: AbortSignal }[] = []
function fakeFetch(url: string, init?: { signal?: AbortSignal }): Promise<unknown> {
  fetchCalls.push({ url, signal: init?.signal })
  if (hostAnswers) {
    return Promise.resolve({ status: hostStatus })
  }
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  })
}

function latest(): MockWebSocket {
  const socket = sockets[sockets.length - 1]
  if (!socket) {
    throw new Error('no socket opened')
  }
  return socket
}

describe('reconnecting once the host answers again', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    sockets.length = 0
    fetchCalls.length = 0
    hostAnswers = false
    hostStatus = 200
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.stubGlobal('fetch', fakeFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    globalThis.WebSocket = originalWebSocket
  })

  it('redials within a second of the tunnel recovering instead of waiting out the dial', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    const stuck = latest()
    stuck.deliversCloseEvent = false
    await vi.advanceTimersByTimeAsync(5_000)
    expect(sockets).toHaveLength(1)

    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)

    expect(sockets).toHaveLength(2)
    expect(stuck.readyState).toBe(MockWebSocket.CLOSED)
    latest().authenticate()
    expect(client.getState()).toBe('connected')
    client.close()
  })

  it('sends no probes at all when a start connects normally', async () => {
    hostAnswers = true
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    await vi.advanceTimersByTimeAsync(300)
    latest().authenticate()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(fetchCalls).toHaveLength(0)
    expect(sockets).toHaveLength(1)
    client.close()
  })

  it('probes once a second, aborts each probe, and gives up after the window', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    await vi.advanceTimersByTimeAsync(1_900)
    expect(fetchCalls).toHaveLength(0)
    // Probing starts 2s in (a normal connect would be done by then), then 1/s.
    await vi.advanceTimersByTimeAsync(8_100)
    expect(fetchCalls.length).toBeGreaterThanOrEqual(8)
    expect(fetchCalls.length).toBeLessThanOrEqual(9)
    expect(fetchCalls[0]!.url).toBe('http://100.84.12.9:6769/')
    // Probes sent at 2..8s have each passed their 1.5s timeout by t=10s.
    expect(fetchCalls.slice(0, 7).every((call) => call.signal?.aborted)).toBe(true)

    await vi.advanceTimersByTimeAsync(REACHABILITY_WINDOW_MS)
    const afterWindow = fetchCalls.length
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchCalls.length).toBe(afterWindow)
    client.close()
  })

  it('starts probing on a foreground nudge while reconnecting', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    fetchCalls.length = 0
    latest().close()
    expect(client.getState()).toBe('reconnecting')

    client.notifyForeground('network-change')
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchCalls.length).toBeGreaterThanOrEqual(1)
    client.close()
  })

  it('replaces a socket that died while away once the host answers over HTTP', async () => {
    hostAnswers = true
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    const dead = latest()
    dead.deliversCloseEvent = false

    client.notifyForeground('app-resume')
    await vi.advanceTimersByTimeAsync(2_000)
    expect(dead.readyState).toBe(MockWebSocket.OPEN)
    expect(sockets).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(dead.readyState).toBe(MockWebSocket.CLOSED)
    expect(sockets).toHaveLength(2)
    latest().authenticate()
    expect(client.getState()).toBe('connected')
    client.close()
  })

  it('tolerates a silent resume while the host itself is unreachable', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    const quiet = latest()

    client.notifyForeground('app-resume')
    await vi.advanceTimersByTimeAsync(8_000)
    expect(quiet.readyState).toBe(MockWebSocket.OPEN)
    expect(client.getState()).toBe('connected')

    // The tunnel comes back while the socket is still silent: it is dead, replace it.
    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(quiet.readyState).toBe(MockWebSocket.CLOSED)
    expect(sockets).toHaveLength(2)
    client.close()
  })

  it('keeps a healthy connection that answers the resume probe even when HTTP answers too', async () => {
    hostAnswers = true
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    const live = latest()

    client.notifyForeground('app-resume')
    expect(live.sent.some((payload) => payload.includes('status.get'))).toBe(true)
    live.replyToProbe()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(live.readyState).toBe(MockWebSocket.OPEN)
    expect(sockets).toHaveLength(1)
    expect(client.getState()).toBe('connected')
    client.close()
  })

  it('closes an abandoned dial that opens late instead of leaving it dangling', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    const abandoned = latest()
    abandoned.deliversCloseEvent = false
    await vi.advanceTimersByTimeAsync(2_000)
    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)
    const current = latest()
    expect(current).not.toBe(abandoned)

    // The native connect was never cancelled, so it completes after all.
    abandoned.readyState = MockWebSocket.CONNECTING
    const closeSpy = vi.spyOn(abandoned, 'close')
    abandoned.open()

    expect(closeSpy).toHaveBeenCalled()
    current.authenticate()
    expect(client.getState()).toBe('connected')
    client.close()
  })

  it('stops probing when the client closes', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    await vi.advanceTimersByTimeAsync(2_000)
    client.close()
    const atClose = fetchCalls.length
    expect(fetchCalls.every((call) => call.signal?.aborted)).toBe(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(fetchCalls.length).toBe(atClose)
  })
})

describe('reachability edge cases', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    sockets.length = 0
    fetchCalls.length = 0
    hostAnswers = false
    hostStatus = 200
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
    vi.stubGlobal('fetch', fakeFetch)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    globalThis.WebSocket = originalWebSocket
  })

  it('restarts the window when a resume arrives late in a running burst', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().deliversCloseEvent = false
    await vi.advanceTimersByTimeAsync(29_000)
    client.notifyForeground('app-resume')
    await vi.advanceTimersByTimeAsync(2_000)

    // Past the original 30s window: only a restarted burst can still see this.
    const before = sockets.length
    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sockets.length).toBeGreaterThan(before)
    client.close()
  })

  it('probes on resume even when the burst went stale while timers were frozen', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().close()
    client.notifyForeground('network-change')
    await vi.advanceTimersByTimeAsync(0)
    // Screen off: wall time moves, no JS timer runs.
    vi.setSystemTime(Date.now() + 90_000)
    const before = fetchCalls.length

    client.notifyForeground('app-resume')
    expect(fetchCalls.length).toBe(before + 1)
    client.close()
  })

  it('never probes or second-guesses a connected socket on an in-app focus nudge', async () => {
    hostAnswers = true
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    const live = latest()

    client.notifyForeground('focus')
    await vi.advanceTimersByTimeAsync(5_000)

    expect(fetchCalls).toHaveLength(0)
    expect(live.readyState).toBe(MockWebSocket.OPEN)
    expect(sockets).toHaveLength(1)
    client.close()
  })

  it('does not replace a dial that is already handshaking', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    await vi.advanceTimersByTimeAsync(2_500)
    const handshaking = latest()
    handshaking.open()
    expect(client.getState()).toBe('handshaking')

    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)
    expect(sockets).toHaveLength(1)
    expect(handshaking.readyState).toBe(MockWebSocket.OPEN)
    client.close()
  })

  it('keeps a resumed socket whose late reply lands before the host answers', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    const live = latest()

    client.notifyForeground('app-resume')
    await vi.advanceTimersByTimeAsync(2_600)
    // Suspect by now; the reply arrives just as the tunnel recovers.
    live.replyToProbe()
    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_000)

    expect(live.readyState).toBe(MockWebSocket.OPEN)
    expect(sockets).toHaveLength(1)
    expect(client.getState()).toBe('connected')
    client.close()
  })

  it('lets a dial started just before the answering probe land', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    latest().close()
    await vi.advanceTimersByTimeAsync(500)
    const fresh = latest()
    expect(client.getState()).toBe('connecting')

    hostAnswers = true
    await vi.advanceTimersByTimeAsync(500)
    client.notifyForeground('network-change')
    await vi.advanceTimersByTimeAsync(0)

    expect(latest()).toBe(fresh)
    expect(fresh.readyState).toBe(MockWebSocket.CONNECTING)
    client.close()
  })

  it('replaces a dial that started well before the answering probe', async () => {
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    latest().close()
    await vi.advanceTimersByTimeAsync(500)
    const stuck = latest()
    stuck.deliversCloseEvent = false

    hostAnswers = true
    await vi.advanceTimersByTimeAsync(1_500)
    client.notifyForeground('network-change')
    await vi.advanceTimersByTimeAsync(0)

    expect(stuck.readyState).toBe(MockWebSocket.CLOSED)
    expect(latest()).not.toBe(stuck)
    client.close()
  })

  it('measures the fresh-dial grace from when the answering probe was sent', async () => {
    // The first answer after a wake can take ~1s; the dial that started just
    // before the probe left is on the same working path and must be kept.
    vi.stubGlobal(
      'fetch',
      () => new Promise((resolve) => setTimeout(() => resolve({ status: 200 }), 900))
    )
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().authenticate()
    latest().close()
    await vi.advanceTimersByTimeAsync(500)
    const fresh = latest()
    await vi.advanceTimersByTimeAsync(200)
    client.notifyForeground('network-change')
    await vi.advanceTimersByTimeAsync(1_000)

    expect(latest()).toBe(fresh)
    expect(fresh.readyState).toBe(MockWebSocket.CONNECTING)
    client.close()
  })

  it('never probes from a short-lived direct-path candidate', async () => {
    hostAnswers = true
    const candidate = connect(TAILSCALE_ENDPOINT, 'token', 'server-key', {
      reachabilityProbing: false
    })
    await vi.advanceTimersByTimeAsync(12_000)
    expect(fetchCalls).toHaveLength(0)
    candidate.close()
  })

  it('does not treat a gateway error as the host answering', async () => {
    hostAnswers = true
    hostStatus = 502
    const client = connect(TAILSCALE_ENDPOINT, 'token', 'server-key')
    latest().deliversCloseEvent = false
    await vi.advanceTimersByTimeAsync(5_000)

    expect(fetchCalls.length).toBeGreaterThanOrEqual(3)
    expect(sockets).toHaveLength(1)
    client.close()
  })
})

describe('RpcReachabilityBurst', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('probes the WebSocket host over plain HTTP without credentials or path', () => {
    expect(reachabilityUrl('ws://100.84.12.9:6769')).toBe('http://100.84.12.9:6769/')
    expect(reachabilityUrl('wss://user:secret@desk.example:7443/rpc?x=1')).toBe(
      'https://desk.example:7443/'
    )
    expect(reachabilityUrl('http://desk.example')).toBeNull()
    expect(reachabilityUrl('not a url')).toBeNull()
  })

  it('reports the first answer once, then stops and aborts the rest', async () => {
    vi.useFakeTimers()
    let answer: (() => void) | null = null
    const signals: AbortSignal[] = []
    const onReachable = vi.fn()
    const burst = new RpcReachabilityBurst({
      endpoint: 'ws://host:1',
      onReachable,
      fetchImpl: (_url, init) => {
        signals.push(init.signal as AbortSignal)
        return new Promise((resolve) => {
          answer ??= () => resolve({})
        })
      }
    })
    burst.start('app-resume')
    await vi.advanceTimersByTimeAsync(1_000)
    expect(signals).toHaveLength(2)

    answer!()
    await vi.advanceTimersByTimeAsync(0)
    expect(onReachable).toHaveBeenCalledTimes(1)
    expect(burst.isActive()).toBe(false)
    expect(signals[1]!.aborted).toBe(true)

    await vi.advanceTimersByTimeAsync(5_000)
    expect(signals).toHaveLength(2)
  })

  it('aborts a probe that does not answer within its timeout', async () => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    const burst = new RpcReachabilityBurst({
      endpoint: 'ws://host:1',
      onReachable: () => {},
      fetchImpl: (_url, init) => {
        signals.push(init.signal as AbortSignal)
        return new Promise(() => {})
      }
    })
    burst.start('focus')
    await vi.advanceTimersByTimeAsync(REACHABILITY_PROBE_TIMEOUT_MS - 1)
    expect(signals[0]!.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(signals[0]!.aborted).toBe(true)
    burst.stop()
  })
})
