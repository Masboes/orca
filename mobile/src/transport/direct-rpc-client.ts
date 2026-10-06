import type { ConnectOptions, RpcClient, SendRequestOptions } from './rpc-client'
import { DirectConnectionLog } from './direct-connection-log'
import { RpcClientAuthenticationRetry } from './rpc-client-authentication-retry'
import { RpcClientConnectionState } from './rpc-client-connection-state'
import {
  RpcClientReconnectSchedule,
  RPC_RECONNECT_ATTEMPT_LIMIT
} from './rpc-client-reconnect-schedule'
import { RpcClientRequestTracker } from './rpc-client-request-tracker'
import { RpcClientSocketCloseController } from './rpc-client-socket-close-controller'
import { RpcClientSocketFactory } from './rpc-client-socket-factory'
import type { RpcClientSocketSession } from './rpc-client-socket-session'
import {
  RpcClientStreamRegistry,
  type RpcStreamingListener,
  type RpcStreamSubscribeOptions
} from './rpc-client-stream-registry'
import { RpcSessionLivenessWatchdog } from './rpc-session-liveness-watchdog'
import { RpcReachabilityBurst } from './rpc-reachability-burst'
import {
  applyForegroundNudge,
  redialOnHostAnswer,
  type ClientNudgeContext
} from './rpc-foreground-nudge'
import type { ConnectionState, ForegroundNudgeReason, RpcResponse } from './types'

const LIVENESS_REQUEST_ID_PREFIX = 'mobile-liveness-'

export class DirectRpcClient implements RpcClient {
  private socketSession: RpcClientSocketSession | null = null
  private readonly connectionState: RpcClientConnectionState
  private readonly reconnect: RpcClientReconnectSchedule
  private readonly requests: RpcClientRequestTracker
  private readonly streams: RpcClientStreamRegistry
  private readonly liveness: RpcSessionLivenessWatchdog
  private readonly socketFactory: RpcClientSocketFactory
  private readonly authenticationRetry: RpcClientAuthenticationRetry
  private readonly socketClose: RpcClientSocketCloseController
  private requestCounter = 0
  private readonly connectionLog: DirectConnectionLog
  private intentionallyClosed = false
  private authenticationGeneration = 0
  private livenessSession: RpcClientSocketSession | null = null
  private readonly reachability: RpcReachabilityBurst
  private readonly nudge: ClientNudgeContext

  constructor(
    private readonly endpoint: string,
    private readonly deviceToken: string,
    serverPublicKeyB64: string,
    private readonly options: ConnectOptions
  ) {
    this.connectionLog = new DirectConnectionLog(endpoint, options.onLog)
    this.reconnect = new RpcClientReconnectSchedule({
      openConnection: () => this.openConnection(),
      rejectConnectWaiters: (reason) => this.connectionState.rejectWaiters(reason),
      emitLog: (message, detail) =>
        this.connectionLog.emit('info', message, detail, { code: 'retry-scheduled' })
    })
    this.connectionState = new RpcClientConnectionState({
      endpoint,
      initialListener: options.onStateChange,
      getReconnectAttempt: () => this.reconnect.getAttempt(),
      isClosed: () => this.intentionallyClosed
    })
    this.streams = new RpcClientStreamRegistry({
      nextId: () => this.nextId(),
      deviceToken,
      getState: () => this.connectionState.get(),
      sendEncrypted: (request) => this.sendEncrypted(request)
    })
    this.requests = new RpcClientRequestTracker({
      nextId: () => this.nextId(),
      deviceToken,
      getState: () => this.connectionState.get(),
      waitForConnected: (timeoutMs) => this.waitForConnected(timeoutMs),
      sendEncrypted: (request) => this.sendEncrypted(request)
    })
    this.liveness = new RpcSessionLivenessWatchdog({
      transport: 'direct',
      sendProbe: (identity) => this.sendLivenessProbe(identity),
      terminate: (identity) => {
        if (identity === this.livenessSession && this.socketSession === this.livenessSession) {
          this.socketClose.forceClose(this.livenessSession)
        }
      },
      onTimeout: this.connectionLog.livenessTimeout
    })
    this.socketFactory = new RpcClientSocketFactory({
      endpoint,
      deviceToken,
      serverPublicKeyB64,
      getCurrentSocket: () => this.socketSession?.socket ?? null,
      getState: () => this.getState(),
      getReconnectAttempt: () => this.getReconnectAttempt(),
      getLastConnectedAt: () => this.getLastConnectedAt(),
      isIntentionallyClosed: () => this.intentionallyClosed,
      emitLog: this.connectionLog.emit,
      onHandshakeStarted: () => this.connectionState.publish('handshaking'),
      onAuthenticated: (session) => this.handleAuthenticated(session),
      onAuthRejected: (reason) => this.authenticationRetry.reject(reason),
      onRpcResponse: (response) => this.handleRpcResponse(response),
      onBinary: (bytes) => this.streams.handleBinary(bytes),
      onAuthenticatedInbound: (session) => this.liveness.noteAuthenticatedInbound(session),
      onClosed: (session, closeCode) => this.socketClose.handle(session, closeCode),
      onForcedClose: (session) => this.socketClose.forceClose(session)
    })
    this.authenticationRetry = new RpcClientAuthenticationRetry({
      endpoint,
      stopLiveness: () => this.stopLiveness(),
      emitWarning: (message, detail) =>
        this.connectionLog.emit('warn', message, detail, { code: 'authentication-rejected' }),
      retry: (reason) => this.retryAuthentication(reason),
      latchFailure: (reason) => this.latchAuthenticationFailure(reason)
    })
    this.socketClose = new RpcClientSocketCloseController({
      connectionState: this.connectionState,
      reconnect: this.reconnect,
      requests: this.requests,
      streams: this.streams,
      socketFactory: this.socketFactory,
      authenticationRetry: this.authenticationRetry,
      getCurrentSession: () => this.socketSession,
      clearCurrentSession: () => (this.socketSession = null),
      getAuthenticationGeneration: () => this.authenticationGeneration,
      isIntentionallyClosed: () => this.intentionallyClosed,
      stopLiveness: (session) => {
        if (this.livenessSession === session) {
          this.stopLiveness()
        }
      },
      emitWarning: (message, detail, evidence) =>
        this.connectionLog.emit('warn', message, detail, evidence)
    })
    this.reachability = new RpcReachabilityBurst({
      endpoint,
      onReachable: (sentAt) => redialOnHostAnswer(this.nudge, sentAt),
      coldStart: options.reachabilityProbing !== false,
      emitLog: (m, d) => this.connectionLog.emit('info', m, d, { code: 'fast-reconnect' })
    })
    this.nudge = {
      isClosed: () => this.intentionallyClosed,
      getState: () => this.getState(),
      getSession: () => this.socketSession,
      getLivenessSession: () => this.livenessSession,
      getInboundCount: () => this.liveness.getInboundCount(),
      getDialStartedAt: () => this.socketFactory.getDialStartedAt(),
      reconnect: this.reconnect,
      reachability: this.reachability,
      probe: () => this.livenessSession && this.liveness.probeNow(this.livenessSession),
      forceClose: (session) => this.socketClose.forceClose(session),
      emitWarning: (m, d) => this.connectionLog.emit('warn', m, d, { code: 'liveness-timeout' }),
      resumeSuspect: null
    }
    this.openConnection()
    this.reachability.start('cold-start')
  }

  sendRequest(
    method: string,
    params?: unknown,
    options?: SendRequestOptions
  ): Promise<RpcResponse> {
    return this.requests.sendRequest(method, params, options)
  }

  subscribe(
    method: string,
    params: unknown,
    onData: RpcStreamingListener,
    options?: RpcStreamSubscribeOptions
  ): () => void {
    return this.streams.subscribe(method, params, onData, options)
  }

  updateTerminalSubscriptionViewport(
    terminal: string,
    viewport: { cols: number; rows: number }
  ): void {
    this.streams.updateTerminalViewport(terminal, viewport)
  }

  getState(): ConnectionState {
    return this.connectionState.get()
  }

  getReconnectAttempt(): number {
    return this.reconnect.getAttempt()
  }

  getLastConnectedAt(): number | null {
    return this.connectionState.getLastConnectedAt()
  }

  getLastInboundAt = (): number | null => this.liveness.getLastInboundAt() || null

  onStateChange(listener: (state: ConnectionState) => void): () => void {
    return this.connectionState.addListener(listener)
  }

  notifyForeground(reason: ForegroundNudgeReason = 'app-resume'): void {
    applyForegroundNudge(this.nudge, reason)
  }

  close(): void {
    this.intentionallyClosed = true
    this.reachability.stop()
    this.reconnect.cancel()
    const session = this.socketSession
    session?.clearTimers()
    if (this.livenessSession) {
      this.liveness.stop(this.livenessSession)
      this.livenessSession = null
    }
    session?.close()
    this.socketSession = null
    session?.clearKey()
    this.connectionState.publish('disconnected')
    this.requests.rejectAll('Client closed', { deliveryUnknown: true })
  }

  private openConnection(): void {
    if (this.intentionallyClosed) {
      return
    }
    this.connectionState.publish('connecting')
    this.socketSession = this.socketFactory.open()
  }

  private handleAuthenticated(session: RpcClientSocketSession): void {
    console.log('[net] e2ee_authenticated — connected', { streamCount: this.streams.size() })
    this.livenessSession = session
    this.liveness.start(session)
    this.reachability.stop()
    this.authenticationGeneration++
    this.reconnect.authenticated()
    this.authenticationRetry.accepted()
    this.connectionState.publish('connected')
    this.connectionLog.emit('success', 'Authenticated', 'Channel ready for RPC', {
      code: 'direct-connected'
    })
    this.streams.replayAfterAuthentication()
  }

  private handleRpcResponse(response: RpcResponse): void {
    if (response.id.startsWith(LIVENESS_REQUEST_ID_PREFIX)) {
      return
    }
    if (!response.ok && response.error.code === 'unauthorized') {
      this.authenticationRetry.reject('Unauthorized — pairing may be revoked')
      return
    }
    if (!this.streams.handleResponse(response)) {
      this.requests.resolve(response)
    }
  }

  private stopLiveness(): void {
    if (this.livenessSession) {
      this.liveness.stop(this.livenessSession)
      this.livenessSession = null
    }
  }

  private retryAuthentication(reason: string): void {
    this.reachability.stop()
    const closing = this.socketSession
    this.socketSession = null
    closing?.clearKey()
    this.streams.markForReplay()
    this.requests.rejectAll(reason)
    closing?.close()
    this.connectionState.publish('reconnecting')
    this.reconnect.schedule()
  }

  private latchAuthenticationFailure(reason: string): void {
    this.intentionallyClosed = true
    this.reachability.stop()
    this.socketSession?.close()
    this.socketSession = null
    this.connectionState.publish('auth-failed')
    this.requests.rejectAll(reason)
  }

  private sendEncrypted(request: unknown): boolean {
    if (this.socketSession) {
      return this.socketSession.sendEncrypted(request)
    }
    console.log('[net] sendEncrypted FAILED — channel not ready', {
      hasWs: false,
      hasKey: false,
      state: this.getState()
    })
    return false
  }

  private sendLivenessProbe(identity: object): boolean {
    if (identity !== this.livenessSession || this.getState() !== 'connected') {
      return false
    }
    return this.sendEncrypted({
      id: `${LIVENESS_REQUEST_ID_PREFIX}${this.nextId()}`,
      deviceToken: this.deviceToken,
      method: 'status.get'
    })
  }

  private waitForConnected(timeoutMs?: number): Promise<void> {
    if (
      this.getState() === 'reconnecting' &&
      this.getReconnectAttempt() >= RPC_RECONNECT_ATTEMPT_LIMIT
    ) {
      return Promise.reject(new Error('Connection retry limit reached'))
    }
    return this.connectionState.waitForConnected(timeoutMs)
  }

  private nextId(): string {
    return `rpc-${++this.requestCounter}-${Date.now()}`
  }
}
