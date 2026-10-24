"use client";

import { appPathname, withBasePath } from "@/lib/base-path";
import { useSyncExternalStore, type ComponentProps } from "react";

export function AppLink({ href = "/", ...props }: ComponentProps<"a">) {
  return <a {...props} href={withBasePath(href)} />;
}

export function useAppRouter() {
  return {
    push(href: string) {
      window.location.assign(withBasePath(href));
    },
    replace(href: string) {
      window.location.replace(withBasePath(href));
    },
  };
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

/** Null during server render so the static HTML stays a shell. */
export function useAppPathname(): string | null {
  return useSyncExternalStore(subscribe, () => appPathname(window.location.pathname), () => null);
}
