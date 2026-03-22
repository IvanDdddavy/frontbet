import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

async function prepare() {
  // Use MSW mocks only when VITE_USE_MOCKS=true (or no backend URL set)
  const useMocks = import.meta.env.VITE_USE_MOCKS === 'true'
    || (!import.meta.env.VITE_WS_URL && import.meta.env.DEV)

  if (useMocks) {
    const { worker } = await import('./mocks/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
    console.info('[MSW] Mock API активен')
  }
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
