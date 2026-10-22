/// <reference types="vite/client" />

declare module "@sinaveg/ui/styles.css";

interface ImportMetaEnv {
  /** Raiz do GeoServer do planaveg_core, sem barra final (ex.: http://127.0.0.1:8085/geoserver). */
  readonly VITE_GEOSERVER_URL?: string;
  /** Workspace publicado pelo planaveg_core. */
  readonly VITE_GEOSERVER_WORKSPACE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
