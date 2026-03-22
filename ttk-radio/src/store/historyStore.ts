import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface BroadcastRecord {
  id: string
  startedAt: string
  endedAt: string | null
  durationSec: number
  peakListeners: number
  messagesCount: number
  wasVideo: boolean
}

interface HistoryState {
  records: BroadcastRecord[]
  currentId: string | null
  startSession: (isVideo: boolean) => void
  endSession: (messagesCount: number) => void
  updatePeak: (listeners: number) => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      records: [],
      currentId: null,

      startSession: (wasVideo) => {
        const id = Date.now().toString()
        const record: BroadcastRecord = {
          id, wasVideo,
          startedAt: new Date().toISOString(),
          endedAt: null,
          durationSec: 0,
          peakListeners: 0,
          messagesCount: 0,
        }
        set(s => ({ records: [record, ...s.records], currentId: id }))
      },

      endSession: (messagesCount) => {
        const { currentId, records } = get()
        if (!currentId) return
        set({
          currentId: null,
          records: records.map(r => {
            if (r.id !== currentId) return r
            const endedAt = new Date().toISOString()
            const durationSec = Math.round(
              (new Date(endedAt).getTime() - new Date(r.startedAt).getTime()) / 1000
            )
            return { ...r, endedAt, durationSec, messagesCount }
          }),
        })
      },

      updatePeak: (listeners) => {
        const { currentId } = get()
        if (!currentId) return
        set(s => ({
          records: s.records.map(r =>
            r.id === currentId && listeners > r.peakListeners
              ? { ...r, peakListeners: listeners }
              : r
          ),
        }))
      },
    }),
    { name: 'ttk-history' }
  )
)
