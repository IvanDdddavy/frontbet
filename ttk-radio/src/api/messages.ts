import { api } from './client'

export type MsgStatus = 'new' | 'in_progress' | 'done'

export interface MessageDto {
  id: string
  senderId: string | null
  senderLogin: string
  content: string
  voicePath: string | null
  status: MsgStatus
  createdAt: string
}

export const messagesApi = {
  send: async (content: string, voiceBlob?: Blob | null): Promise<MessageDto> => {
    const form = new FormData()
    form.append('content', content)
    if (voiceBlob) {
      form.append('voice', voiceBlob, 'voice.webm')
    }
    const { data } = await api.post<MessageDto>('/messages', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  getAll: async (includeDone = false): Promise<MessageDto[]> => {
    const { data } = await api.get<MessageDto[]>('/messages', {
      params: { include_done: includeDone },
    })
    return data
  },

  setStatus: async (id: string, status: MsgStatus): Promise<MessageDto> => {
    const { data } = await api.patch<MessageDto>(`/messages/${id}/status`, { status })
    return data
  },
}
