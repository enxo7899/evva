"use client";

import { useEffect, useRef } from "react";

export const useJobPolling = (
  active: boolean,
  poll: () => Promise<void>,
  intervalMs: number = 1000
) => {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => {
      void pollRef.current();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [active, intervalMs]);
};
