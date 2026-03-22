import { api } from './client'

export interface MediaFileDto {
  id: string
  filename: string
  mediaType: 'audio' | 'video'
  mimeType: string
  sizeBytes: number
  uploadedAt: string
  url: string   // public playback URL: /media/owner_id/file_id.ext
}

export interface PlaylistItemDto {
  id: number
  position: number
  mediaFile: MediaFileDto
}

export interface PlaylistDto {
  id: string
  title: string
  loopMode: boolean
  shuffleMode: boolean
  items: PlaylistItemDto[]
}

const MAX_AUDIO_MB = 50
const MAX_VIDEO_MB = 1000
const AUDIO_MIME   = new Set(['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp3'])
const VIDEO_MIME   = new Set(['video/mp4', 'video/webm'])

export function validateMediaFile(file: File): string | null {
  const mime   = file.type
  const sizeMb = file.size / 1024 / 1024
  if (AUDIO_MIME.has(mime)) {
    if (sizeMb > MAX_AUDIO_MB) return `Аудио файл превышает ${MAX_AUDIO_MB} МБ`
    return null
  }
  if (VIDEO_MIME.has(mime)) {
    if (sizeMb > MAX_VIDEO_MB) return `Видео файл превышает ${MAX_VIDEO_MB} МБ`
    return null
  }
  return `Формат не поддерживается: ${mime || file.name}`
}

export const mediaApi = {
  getLibrary: async (): Promise<MediaFileDto[]> => {
    const { data } = await api.get<MediaFileDto[]>('/media/library')
    return data
  },

  uploadFile: async (file: File, onProgress?: (pct: number) => void): Promise<MediaFileDto> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post<MediaFileDto>('/media/library', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total))
      },
    })
    return data
  },

  deleteFile: async (id: string): Promise<void> => {
    await api.delete(`/media/library/${id}`)
  },

  getPlaylists: async (): Promise<PlaylistDto[]> => {
    const { data } = await api.get<PlaylistDto[]>('/media/playlists')
    return data
  },

  createPlaylist: async (title: string): Promise<PlaylistDto> => {
    const { data } = await api.post<PlaylistDto>('/media/playlists', { title })
    return data
  },

  updatePlaylist: async (
    id: string,
    patch: { title?: string; loop_mode?: boolean; shuffle_mode?: boolean; item_ids?: string[] }
  ): Promise<PlaylistDto> => {
    const { data } = await api.put<PlaylistDto>(`/media/playlists/${id}`, patch)
    return data
  },
}
