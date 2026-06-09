"use client";

import { useSyncExternalStore } from "react";

/**
 * useSyncExternalStore requires `getSnapshot` to return a *stable* value between
 * subscribe notifications. Returning `Date.now()` directly causes React to see
 * a different value every time it checks for tearing → infinite re-render.
 *
 * Solution: cache the last snapshot in a module-level variable. Only mutate it
 * when the interval subscription fires.
 */

let nowCache = 0;
const nowListeners = new Set<() => void>();
let nowIntervalId: ReturnType<typeof setInterval> | null = null;

function nowSubscribe(cb: () => void) {
  if (nowListeners.size === 0) {
    nowCache = Date.now();
    nowIntervalId = setInterval(() => {
      nowCache = Date.now();
      nowListeners.forEach((l) => l());
    }, 60_000);
  }
  nowListeners.add(cb);
  // Set initial value when first subscribing on the client
  if (nowCache === 0) nowCache = Date.now();
  return () => {
    nowListeners.delete(cb);
    if (nowListeners.size === 0 && nowIntervalId != null) {
      clearInterval(nowIntervalId);
      nowIntervalId = null;
    }
  };
}

function nowSnapshot() {
  return nowCache;
}

function nowServerSnapshot() {
  return 0;
}

/**
 * Reactive `Date.now()` that's safe to call during render.
 * Returns 0 on the server / first paint, then real ms after subscription.
 * Updates once per minute.
 */
export function useNow() {
  return useSyncExternalStore(nowSubscribe, nowSnapshot, nowServerSnapshot);
}

// ---------- HH:MM:SS clock ----------

let clockCache = "";
const clockListeners = new Set<() => void>();
let clockIntervalId: ReturnType<typeof setInterval> | null = null;

function formatClock() {
  const d = new Date();
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function clockSubscribe(cb: () => void) {
  if (clockListeners.size === 0) {
    clockCache = formatClock();
    clockIntervalId = setInterval(() => {
      clockCache = formatClock();
      clockListeners.forEach((l) => l());
    }, 1000);
  }
  clockListeners.add(cb);
  if (clockCache === "") clockCache = formatClock();
  return () => {
    clockListeners.delete(cb);
    if (clockListeners.size === 0 && clockIntervalId != null) {
      clearInterval(clockIntervalId);
      clockIntervalId = null;
    }
  };
}

function clockSnapshot() {
  return clockCache;
}

function clockServerSnapshot() {
  return "";
}

/**
 * Reactive HH:MM:SS clock — separate hook because it ticks every second.
 */
export function useClock() {
  return useSyncExternalStore(
    clockSubscribe,
    clockSnapshot,
    clockServerSnapshot
  );
}
