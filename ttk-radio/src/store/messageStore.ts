import { create } from 'zustand'

export type MsgStatus = 'new' | 'in_progress' | 'done'

export interface Message {
  id: string
  senderId: string
  senderLogin: string
  content: string
  voicePath?: string
  status: MsgStatus
  createdAt: string
}

interface MessageState {
  messages: Message[]
  addMessage: (m: Omit<Message, 'id' | 'createdAt' | 'status'>) => void
  setStatus: (id: string, status: MsgStatus) => void
}

export const useMessageStore = create<MessageState>()((set) => ({
  messages: [
    { id: '1', senderId: 'u1', senderLogin: 'ivanov_a', content: 'Привет! Поставьте что-нибудь весёлое', status: 'new', createdAt: new Date(Date.now() - 300000).toISOString() },
    { id: '2', senderId: 'u2', senderLogin: 'petrov_k', content: 'Можно поздравить именинника?', status: 'new', createdAt: new Date(Date.now() - 120000).toISOString() },
    { id: '3', senderId: 'u3', senderLogin: 'sidorova_m', content: 'Отличная трансляция, спасибо!', status: 'in_progress', createdAt: new Date(Date.now() - 60000).toISOString() },
  ],
  addMessage: (m) => set((s) => ({
    messages: [...s.messages, {
      ...m,
      id: Date.now().toString(),
      status: 'new',
      createdAt: new Date().toISOString(),
    }]
  })),
  setStatus: (id, status) => set((s) => ({
    messages: s.messages.map(m => m.id === id ? { ...m, status } : m)
  })),
}))
