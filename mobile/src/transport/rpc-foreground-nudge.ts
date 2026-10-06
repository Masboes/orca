import type { RpcClientReconnectSchedule } from './rpc-client-reconnect-schedule'
import type { RpcClientSocketSession } from './rpc-client-socket-session'
import type { RpcReachabilityBurst } from './rpc-reachability-burst'
import { isStaleForegroundDial } from './rpc-stale-dial'
import type { ConnectionState, ForegroundNudgeReason } from './types'

// A live socket answers a probe within an RTT. If it is still silent after this,
// ask the host over HTTP: an answer there means the path is up and this socket
// is dead, so redial instead of waiting out three 8s liveness misses (~24s).
// Silence alone is not enough; a slow wake-up is tolerated as before.
export const RESUME_PROBE_DEADLINE_MS = 2_500
// A dial started this close to a probe that got through uses the same, working
// path; let it land instead of replacing it.
export const FRESH_DIAL_GRACE_MS = 1_000

export type ClientNudgeContext = {
  isClosed: () => boolean
  getState: () => ConnectionState
  getSession: () => RpcClientSocketSession | null
  getLivenessSession: () => RpcClientSocketSession | null
  getInboundCount: () => number
  getDialStartedAt: () => number
  reconnect: RpcClientReconnectSchedule
  reachability: RpcReachabilityBurst
  probe: () => void
  forceClose: (session: RpcClientSocketSession) => void
  emitWarning: (message: string, detail: string) => void
  resumeSuspect: { session: RpcClientSocketSession; inboundCount: number } | null
}

export function applyForegroundNudge(ctx: ClientNudgeContext, reason: ForegroundNudgeReason): void {
  if (ctx.isClosed()) {
    return
  }
  if (ctx.getState() === 'connected') {
    console.log('[net] foreground — probing live connection')
    ctx.probe()
    if (reason === 'app-resume') {
      verifyAfterResume(ctx)
    }
    return
  }
  ctx.reachability.start(reason)
  const dialing = ctx.getSession()
  const dialAgeMs = Date.now() - ctx.getDialStartedAt()
  let abandoned = false
  if (dialing && isStaleForegroundDial(ctx.getState(), dialAgeMs)) {
    console.log('[net] foreground — abandoning stale dial', { state: ctx.getState(), dialAgeMs })
    ctx.forceClose(dialing)
    abandoned = true
  }
  // Re-read: abandoning the dial above moves the client to 'reconnecting'.
  if (ctx.getState() === 'reconnecting') {
    console.log('[net] foreground — restarting reconnect loop', {
      attempt: ctx.reconnect.getAttempt(),
      hadTimer: ctx.reconnect.hasTimer()
    })
    ctx.reconnect.redialNow(!abandoned)
  }
}

export function redialOnHostAnswer(ctx: ClientNudgeContext, probeSentAt: number): void {
  const state = ctx.getState()
  const suspect = ctx.resumeSuspect
  ctx.resumeSuspect = null
  if (ctx.isClosed() || state === 'handshaking') {
    return
  }
  if (state === 'connected') {
    const live = ctx.getLivenessSession()
    if (suspect && live === suspect.session && ctx.getInboundCount() === suspect.inboundCount) {
      ctx.emitWarning(
        'No reply after resume',
        'The host answers but this connection does not; reconnecting'
      )
      ctx.forceClose(live)
      ctx.reconnect.redialNow(true)
    }
    return
  }
  const session = ctx.getSession()
  if (
    state === 'connecting' &&
    session &&
    probeSentAt - ctx.getDialStartedAt() < FRESH_DIAL_GRACE_MS
  ) {
    return
  }
  console.log('[net] host answered a reachability probe — redialing now', { state })
  if (session) {
    ctx.forceClose(session)
  }
  ctx.reconnect.redialNow(true)
}

function verifyAfterResume(ctx: ClientNudgeContext): void {
  const session = ctx.getLivenessSession()
  const inboundCount = ctx.getInboundCount()
  setTimeout(() => {
    if (ctx.isClosed() || ctx.getState() !== 'connected' || !session) {
      return
    }
    if (ctx.getLivenessSession() !== session || ctx.getInboundCount() !== inboundCount) {
      return
    }
    console.log('[net] foreground — resume probe unanswered, asking the host')
    ctx.resumeSuspect = { session, inboundCount }
    ctx.reachability.start('app-resume')
  }, RESUME_PROBE_DEADLINE_MS)
}
