import { useEffect, useRef } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";

/**
 * Subscribe to a Tauri event for the lifetime of the component.
 *
 * `listen()` is async, so the naive `listen(...).then(u => unsubs.push(u))`
 * leaks: if the component unmounts before the promise resolves (StrictMode's
 * double mount in dev, a settings tab switched quickly in prod), the cleanup
 * runs with nothing to call and the handler stays registered forever. Here
 * a late-arriving unlisten is called immediately instead.
 *
 * The handler is read through a ref, so passing a fresh closure on every
 * render neither re-subscribes nor goes stale.
 *
 *   useTauriEvent(events.onHistoryNew, (entry) => setHistory(h => [entry, ...h]));
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useTauriEvent<H extends (...args: any[]) => void>(
  subscribe: (handler: H) => Promise<UnlistenFn>,
  handler: H,
  enabled = true
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;

    subscribe(((...args: Parameters<H>) => handlerRef.current(...args)) as H)
      .then((u) => {
        if (disposed) u();
        else unlisten = u;
      })
      .catch(() => {});

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [subscribe, enabled]);
}
