// After an Android phone wakes, its Tailscale tunnel can drop traffic for ~15s
// (tailscale#21650), and the client's dial sits in SYN backoff past the moment
// it recovers. React Native cannot cancel a WebSocket that has not opened
// (WebSocketModule.close() is a no-op until onOpen), so extra dials would pile
// up natively. A HEAD probe can be cancelled, so probe once a second instead and
// redial the moment the host answers.
export const REACHABILITY_WINDOW_MS = 30_000
export const REACHABILITY_INTERVAL_MS = 1_000
export const REACHABILITY_PROBE_TIMEOUT_MS = 1_500
// A start that connects within this never probes, which also keeps the
// short-lived direct-return probe clients from sending requests.
export const COLD_START_PROBE_DELAY_MS = 2_000

export type ReachabilityTrigger = 'cold-start' | 'app-resume' | 'network-change' | 'focus'

type ReachabilityBurstOptions = {
  endpoint: string
  // false for short-lived direct-path candidates; only the long-lived session probes on start.
  coldStart?: boolean
  // sentAt: when the answering probe left, i.e. a moment the path was known up.
  onReachable: (sentAt: number) => void
  emitLog?: (message: string, detail: string) => void
  fetchImpl?: (url: string, init: RequestInit) => Promise<unknown>
  now?: () => number
}

// Same host and port as the WebSocket endpoint; any HTTP answer, even an error
// status, proves the path is up. Credentials and paths are dropped.
export function reachabilityUrl(endpoint: string): string | null {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return null
    }
    return `${url.protocol === 'wss:' ? 'https:' : 'http:'}//${url.host}/`
  } catch {
    return null
  }
}

export class RpcReachabilityBurst {
  private readonly url: string | null
  private readonly now: () => number
  private startedAt: number | null = null
  private generation = 0
  private trigger: ReachabilityTrigger | null = null
  private probes = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly inFlight = new Set<AbortController>()

  constructor(private readonly options: ReachabilityBurstOptions) {
    this.url = reachabilityUrl(options.endpoint)
    this.now = options.now ?? Date.now
  }

  isActive(): boolean {
    return this.startedAt !== null
  }

  // A nudge always restarts: Android pauses JS timers in the background, so a
  // burst from before the screen went off can still look active on resume.
  start(trigger: ReachabilityTrigger): void {
    if (this.url === null || typeof AbortController === 'undefined') {
      return
    }
    if (trigger === 'cold-start' && this.options.coldStart === false) {
      return
    }
    if (this.startedAt !== null) {
      const expired = this.now() - this.startedAt >= REACHABILITY_WINDOW_MS
      if (trigger === 'cold-start' && !expired) {
        return
      }
      this.stop()
    }
    this.generation++
    this.startedAt = this.now()
    this.trigger = trigger
    this.probes = 0
    if (trigger !== 'cold-start') {
      this.options.emitLog?.(
        'Watching for the host',
        `Trigger: ${trigger}; probing once a second for ${REACHABILITY_WINDOW_MS / 1000}s`
      )
    }
    if (trigger === 'cold-start') {
      this.timer = setTimeout(() => this.tick(), COLD_START_PROBE_DELAY_MS)
    } else {
      this.tick()
    }
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    for (const controller of this.inFlight) {
      controller.abort()
    }
    this.inFlight.clear()
    this.startedAt = null
    this.trigger = null
  }

  private tick(): void {
    this.timer = null
    if (this.startedAt === null) {
      return
    }
    if (this.now() - this.startedAt >= REACHABILITY_WINDOW_MS) {
      this.options.emitLog?.(
        'Host still unreachable',
        `${this.probes} probes in ${REACHABILITY_WINDOW_MS / 1000}s; normal retries continue`
      )
      this.stop()
      return
    }
    this.probe()
    this.timer = setTimeout(() => this.tick(), REACHABILITY_INTERVAL_MS)
  }

  private probe(): void {
    const url = this.url
    if (url === null) {
      return
    }
    const generation = this.generation
    const startedAt = this.startedAt ?? this.now()
    const sentAt = this.now()
    const controller = new AbortController()
    this.inFlight.add(controller)
    this.probes++
    const timeout = setTimeout(() => controller.abort(), REACHABILITY_PROBE_TIMEOUT_MS)
    const doFetch = this.options.fetchImpl ?? ((u: string, init: RequestInit) => fetch(u, init))
    doFetch(url, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        if (
          controller.signal.aborted ||
          this.startedAt === null ||
          // also covers fetch implementations that ignore AbortSignal
          this.generation !== generation
        ) {
          return
        }
        // A gateway error (proxy or tunnel in front of a down daemon) is not the host.
        const status = (response as { status?: unknown } | null)?.status
        if (typeof status === 'number' && status >= 500) {
          return
        }
        if (this.probes > 1) {
          const elapsedMs = this.now() - startedAt
          this.options.emitLog?.(
            'Host answered',
            `After ${(elapsedMs / 1000).toFixed(1)}s and ${this.probes} probes (trigger: ${this.trigger})`
          )
        }
        this.stop()
        this.options.onReachable(sentAt)
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout)
        this.inFlight.delete(controller)
      })
  }
}
