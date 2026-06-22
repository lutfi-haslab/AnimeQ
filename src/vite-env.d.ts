/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AnimeOnsen search bearer token (value only, no "Bearer " prefix). */
  readonly VITE_ANIMEONSEN_SEARCH_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
