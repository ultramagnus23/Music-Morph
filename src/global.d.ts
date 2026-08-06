import type { HandshakeApi } from "../electron/preload";

declare global {
  interface Window {
    handshake: HandshakeApi;
  }
}

export {};
