import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useEffect, useRef } from 'react'
import { chatHubUrl, clearApiCache, realtimeHubUrl } from './api'
import type { ChatMessage, Conversation, SlotAvailabilityUpdate } from './types'

let sharedAvailabilityConnection: HubConnection | null = null
let isStartingAvailability = false
const slotAvailabilityListeners = new Set<(update: SlotAvailabilityUpdate) => void>()
const notificationListeners = new Set<(payload: RealtimeNotificationPayload) => void>()

function ensureAvailabilityConnection(): HubConnection {
  if (!sharedAvailabilityConnection) {
    const connection = new HubConnectionBuilder()
      .withUrl(realtimeHubUrl)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('slotAvailabilityChanged', (update: SlotAvailabilityUpdate) => {
      clearApiCache('/slots')
      clearApiCache('/provider/slots')
      slotAvailabilityListeners.forEach((listener) => {
        try {
          listener(update)
        } catch {
          // ignore callback error
        }
      })
    })

    connection.on('userNotification', (payload: RealtimeNotificationPayload) => {
      notificationListeners.forEach((listener) => {
        try {
          listener(payload)
        } catch {
          // ignore callback error
        }
      })
    })

    sharedAvailabilityConnection = connection
  }

  if (sharedAvailabilityConnection.state === HubConnectionState.Disconnected && !isStartingAvailability) {
    isStartingAvailability = true
    sharedAvailabilityConnection.start()
      .catch(() => {
        // Safe fallback if network or proxy blocks WebSockets
      })
      .finally(() => {
        isStartingAvailability = false
      })
  }

  return sharedAvailabilityConnection
}

/** Keeps marketplace pages synchronized when another customer holds, releases or books a slot. */
export function useSlotAvailability(onChanged: (update: SlotAvailabilityUpdate) => void) {
  const handlerRef = useRef(onChanged)

  useEffect(() => {
    handlerRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    ensureAvailabilityConnection()

    const listener = (update: SlotAvailabilityUpdate) => {
      handlerRef.current(update)
    }

    slotAvailabilityListeners.add(listener)

    return () => {
      slotAvailabilityListeners.delete(listener)
    }
  }, [])
}

/** Realtime chat events for Customer, Provider and Platform Support. */
export function useChatRealtime(
  token: string | undefined,
  activeConversationId: string | null,
  onMessageReceived: (message: ChatMessage) => void,
  onConversationUpdated?: (conversation: Conversation) => void
) {
  const connectionRef = useRef<HubConnection | null>(null)
  const activeConversationRef = useRef(activeConversationId)
  const messageReceivedRef = useRef(onMessageReceived)
  const conversationUpdatedRef = useRef(onConversationUpdated)

  useEffect(() => {
    messageReceivedRef.current = onMessageReceived
  }, [onMessageReceived])

  useEffect(() => {
    conversationUpdatedRef.current = onConversationUpdated
  }, [onConversationUpdated])

  useEffect(() => {
    if (!token) return

    let isStarted = false
    let isStopped = false

    const connection = new HubConnectionBuilder()
      .withUrl(chatHubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    connectionRef.current = connection

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      messageReceivedRef.current(msg)
    })

    connection.on('ConversationUpdated', (conv: Conversation) => {
      conversationUpdatedRef.current?.(conv)
    })

    connection.start().then(() => {
      isStarted = true
      if (isStopped) {
        if (connection.state !== HubConnectionState.Disconnected) {
          void connection.stop().catch(() => {})
        }
        return
      }
      const convId = activeConversationRef.current
      if (convId && connection.state === HubConnectionState.Connected) {
        void connection.invoke('JoinConversation', convId).catch(() => {})
      }
    }).catch(() => {})

    return () => {
      isStopped = true
      connection.off('ReceiveMessage')
      connection.off('ConversationUpdated')
      if (isStarted && connection.state !== HubConnectionState.Disconnected) {
        void connection.stop().catch(() => {})
      }
    }
  }, [token])

  useEffect(() => {
    activeConversationRef.current = activeConversationId
    const conn = connectionRef.current
    if (conn && conn.state === HubConnectionState.Connected && activeConversationId) {
      void conn.invoke('JoinConversation', activeConversationId).catch(() => {})
    }
  }, [activeConversationId])
}

export type RealtimeNotificationPayload = {
  targetUserId: string
  title: string
  message: string
  link?: string | null
}

/** In-app real-time notification alerts (cancellations, new bookings, support ticket replies). */
export function useRealtimeNotifications(
  userId: string | undefined,
  onNotification: (payload: RealtimeNotificationPayload) => void
) {
  const handlerRef = useRef(onNotification)
  const userIdRef = useRef(userId)

  useEffect(() => {
    handlerRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  useEffect(() => {
    if (!userId) return

    ensureAvailabilityConnection()

    const listener = (payload: RealtimeNotificationPayload) => {
      if (payload && payload.targetUserId === userIdRef.current) {
        handlerRef.current(payload)
      }
    }

    notificationListeners.add(listener)

    return () => {
      notificationListeners.delete(listener)
    }
  }, [userId])
}

