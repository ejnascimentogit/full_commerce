"use client";

import { useEffect } from "react";

// Registra o service worker (instalação como app). Se o navegador não suportar, segue sem nada.
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
