/// <reference types="vite/client" />

declare module '*.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_USE_MOCKS: string
  readonly VITE_WS_URL: string
  readonly VITE_STREAM_URL: string
  readonly VITE_BACKEND_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
