import { create } from 'zustand'

interface StreamState {
  isLive: boolean
  isVideo: boolean
  currentTrack: string | null
  volume: number
  setLive: (v: boolean) => void
  setVideo: (v: boolean) => void
  setTrack: (t: string | null) => void
  setVolume: (v: number) => void
}

export const useStreamStore = create<StreamState>()((set) => ({
  isLive: false,
  isVideo: false,
  currentTrack: null,
  volume: 80,
  setLive: (isLive) => set({ isLive }),
  setVideo: (isVideo) => set({ isVideo }),
  setTrack: (currentTrack) => set({ currentTrack }),
  setVolume: (volume) => set({ volume }),
}))
