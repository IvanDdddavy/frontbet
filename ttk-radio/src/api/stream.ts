import { api } from './client'

export interface StreamStateDto {
  isLive:       boolean
  isVideo:      boolean
  currentTrack: string | null
  listeners:    number
}

export const streamApi = {
  getState: async (): Promise<StreamStateDto> => {
    const { data } = await api.get<StreamStateDto>('/stream')
    return data
  },

  setState: async (patch: Partial<Pick<StreamStateDto, 'isLive' | 'isVideo' | 'currentTrack'>>): Promise<StreamStateDto> => {
    const { data } = await api.post<StreamStateDto>('/stream', patch)
    return data
  },

  getStreamUrl: async (): Promise<{ url: string }> => {
    try {
      const { data } = await api.get<{ url: string }>('/stream/url')
      return data
    } catch {
      return { url: '' }
    }
  },
}
