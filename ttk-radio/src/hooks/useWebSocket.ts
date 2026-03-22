import { useEffect, useRef, useState, useCallback } from 'react'
import { useStreamStore } from '../store/streamStore'
import { useMessageStore } from '../store/messageStore'
import { toast } from '../store/toastStore'

type WsMessage =
  | { type: 'stream_state'; isLive: boolean; isVideo: boolean; track: string | null; listeners: number }
  | { type: 'new_message'; senderLogin: string; content: string }
  | { type: 'message_status'; id: string; status: string }
  | { type: 'listeners_update'; count: number }
  | { type: 'volume_change'; volume: number }

// Если VITE_WS_URL не задан или пустой — строим URL из текущего хоста (nginx проксирует /ws → бэкенд)
const _envWs = import.meta.env.VITE_WS_URL as string | undefined
const WS_URL: string | null = (_envWs && _envWs.trim())
  ? _envWs.trim()
  : (import.meta.env.VITE_USE_MOCKS === 'true' ? null : `ws://${location.host}/ws`)

type WsHandle = { send: (d: string) => void; close: () => void }

function createMockWs(onMessage: (msg: WsMessage) => void): WsHandle {
  let stopped = false
  let count = 3

  setTimeout(() => {
    if (!stopped) onMessage({ type: 'stream_state', isLive: false, isVideo: false, track: null, listeners: count })
  }, 500)

  const interval = setInterval(() => {
    if (stopped) return
    count = Math.max(1, count + Math.floor(Math.random() * 3) - 1)
    onMessage({ type: 'listeners_update', count })
  }, 7000)

  return { send: () => {}, close: () => { stopped = true; clearInterval(interval) } }
}

function createRealWs(url: string, token: string | null, onMessage: (msg: WsMessage) => void): WsHandle {
  let ws: WebSocket
  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let retryDelay = 2000

  const connect = () => {
    ws = new WebSocket(token ? `${url}?token=${encodeURIComponent(token)}` : url)
    ws.onmessage = (e) => { try { onMessage(JSON.parse(e.data)) } catch { /* ignore */ } }
    ws.onerror   = () => { /* handled by onclose */ }
    ws.onclose   = (e) => {
      if (stopped) return
      if (e.code !== 1000) {
        retryTimer = setTimeout(() => {
          if (!stopped) connect()
          retryDelay = Math.min(retryDelay * 1.5, 15000)
        }, retryDelay)
      }
    }
    ws.onopen = () => { retryDelay = 2000 }
  }

  connect()

  return {
    send:  (d) => { if (ws?.readyState === WebSocket.OPEN) ws.send(d) },
    close: () => {
      stopped = true
      if (retryTimer) clearTimeout(retryTimer)
      ws?.close(1000)
    },
  }
}

export function useWebSocket(token: string | null) {
  const { setLive, setVideo, setTrack } = useStreamStore()
  const { addMessage, setStatus } = useMessageStore()
  const [listeners, setListeners] = useState(0)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WsHandle | null>(null)

  const handleMessage = useCallback((msg: WsMessage) => {
    switch (msg.type) {
      case 'stream_state':
        setLive(msg.isLive); setVideo(msg.isVideo); setTrack(msg.track); setListeners(msg.listeners); break
      case 'new_message':
        addMessage({ senderId: 'ws', senderLogin: msg.senderLogin, content: msg.content })
        toast.info(`Новое сообщение от ${msg.senderLogin}`)
        break
      case 'message_status':
        setStatus(msg.id, msg.status as any); break
      case 'listeners_update':
        setListeners(msg.count); break
      case 'volume_change': {
        const { setVolume } = useStreamStore.getState()
        setVolume(msg.volume); break
      }
    }
  }, [setLive, setVideo, setTrack, addMessage, setStatus])

  useEffect(() => {
    wsRef.current = WS_URL ? createRealWs(WS_URL, token, handleMessage) : createMockWs(handleMessage)
    setConnected(true)
    return () => { wsRef.current?.close(); wsRef.current = null; setConnected(false) }
  }, [token, handleMessage])

  const sendWs = useCallback((payload: object) => wsRef.current?.send(JSON.stringify(payload)), [])

  return { listeners, connected, sendWs }
}
