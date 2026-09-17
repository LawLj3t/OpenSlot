import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useEffect, useRef } from 'react'
import { chatHubUrl, realtimeHubUrl } from './api'
import type { ChatMessage, Conversation, SlotAvailabilityUpdate } from './types'

/** Keeps marketplace pages synchronized when another customer holds, releases or books a slot. */
export function useSlotAvailability(onChanged: (update: SlotAvailabilityUpdate) => void) {
  useEffect(() => {
    const connection = new HubConnectionBuilder()
      .withUrl(realtimeHubUrl)
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    connection.on('slotAvailabilityChanged', onChanged)
    void connection.start().catch(() => {
      // The normal REST fetches remain a safe fallback if a network or proxy blocks WebSockets.
    })

    return () => {
      connection.off('slotAvailabilityChanged', onChanged)
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [onChanged])
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

  useEffect(() => {
    if (!token) return

    const connection = new HubConnectionBuilder()
      .withUrl(chatHubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000])
      .configureLogging(LogLevel.Warning)
      .build()

    connectionRef.current = connection

    connection.on('ReceiveMessage', (msg: ChatMessage) => {
      onMessageReceived(msg)
    })

    if (onConversationUpdated) {
      connection.on('ConversationUpdated', (conv: Conversation) => {
        onConversationUpdated(conv)
      })
    }

    void connection.start().then(() => {
      const convId = activeConversationRef.current
      if (convId && connection.state === HubConnectionState.Connected) {
        void connection.invoke('JoinConversation', convId).catch(() => {})
      }
    }).catch(() => {})

    return () => {
      connection.off('ReceiveMessage')
      connection.off('ConversationUpdated')
      if (connection.state !== HubConnectionState.Disconnected) {
        void connection.stop()
      }
    }
  }, [token, onMessageReceived, onConversationUpdated])

  useEffect(() => {
    activeConversationRef.current = activeConversationId
    const conn = connectionRef.current
    if (conn && conn.state === HubConnectionState.Connected && activeConversationId) {
      void conn.invoke('JoinConversation', activeConversationId).catch(() => {})
    }
  }, [activeConversationId])
}
