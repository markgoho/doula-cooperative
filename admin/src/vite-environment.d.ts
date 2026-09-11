/// <reference types="vite/client" />

interface ImportMetaEnvironment {
  readonly VITE_USE_PRODUCTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnvironment;
}
