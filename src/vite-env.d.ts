/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Neon → Auth → Auth URL */
  readonly VITE_NEON_AUTH_URL?: string;
  /** Neon → Data API → API URL */
  readonly VITE_NEON_DATA_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
