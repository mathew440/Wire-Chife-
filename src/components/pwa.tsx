"use client";

import { assetPath, BASE_PATH } from "@/lib/base-path";
import { useEffect } from "react";

export function ServiceWorkerEffect() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register(assetPath("/sw.js"), { scope: `${BASE_PATH}/` }).catch(() => {
      // Offline caching is optional. The job book still saves in IndexedDB.
    });
  }, []);
  return null;
}
