/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL, e.g. https://api.example/api/v1. Defaults to the same origin's /api/v1. */
  readonly VITE_API_URL?: string
}
