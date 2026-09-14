import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import { useEffect } from 'react'
import { realtimeHubUrl } from './api'
import type { SlotAvailabilityUpdate } from './types'

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
