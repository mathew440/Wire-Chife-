"use client";

import { ensureSeeded } from "@/lib/data/seed";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ReadyState = { status: "loading" | "ready" | "error"; error: string | null };

const ReadyContext = createContext<ReadyState>({ status: "loading", error: null });

export function DbProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReadyState>({ status: "loading", error: null });

  useEffect(() => {
    let cancelled = false;
    ensureSeeded()
      .then(() => {
        if (!cancelled) setState({ status: "ready", error: null });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Could not open on-device storage.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <ReadyContext.Provider value={state}>{children}</ReadyContext.Provider>;
}

export function useDbReady(): ReadyState {
  return useContext(ReadyContext);
}
