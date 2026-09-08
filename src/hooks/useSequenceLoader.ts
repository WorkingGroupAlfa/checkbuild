import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SequenceFrame } from '../lib/assetManifest';
import { FrameCache } from '../lib/frameCache';

function requestIdle(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 1800 });
  }
  return globalThis.setTimeout(callback, 500);
}

export function useSequenceLoader(
  frames: SequenceFrame[],
  frontFrame: number,
  currentFrame: number,
  selected: boolean,
  fallback: boolean,
) {
  const [ready, setReady] = useState<Set<number>>(() => new Set([frontFrame]));
  const [hiReady, setHiReady] = useState<Set<number>>(() => new Set());
  const readyRef = useRef(new Set([frontFrame]));
  const isMobile = useMemo(() => window.matchMedia('(max-width: 720px)').matches, []);
  const cache = useRef(new FrameCache(isMobile ? 7 : 9));
  const pending = useRef(new Map<number, Promise<void>>());
  const saveData = navigator.connection?.saveData === true;

  const preload = useCallback((index: number) => {
    if (!frames[index] || readyRef.current.has(index)) return Promise.resolve();
    const existing = pending.current.get(index);
    if (existing) return existing;
    const promise = new Promise<void>((resolve) => {
      const image = new Image();
      image.decoding = 'async';
      const frame = frames[index];
      image.onload = async () => {
        try { await image.decode?.(); } catch { /* onload already confirms a usable fallback */ }
        cache.current.set(index, image);
        readyRef.current.add(index);
        setReady(new Set(readyRef.current));
        pending.current.delete(index);
        resolve();
      };
      image.onerror = () => {
        if (!image.src.endsWith('.jpg')) image.src = isMobile ? frame.beautySmallFallback : frame.beautyMediumFallback;
        else { pending.current.delete(index); resolve(); }
      };
      image.src = isMobile ? frame.beautySmall : frame.beautyMedium;
    });
    pending.current.set(index, promise);
    return promise;
  }, [frames, isMobile]);

  useEffect(() => {
    if (fallback) return;
    const radius = isMobile ? 2 : 3;
    void preload(currentFrame);
    for (let distance = 1; distance <= radius; distance += 1) {
      void preload(currentFrame - distance);
      void preload(currentFrame + distance);
    }
  }, [currentFrame, fallback, isMobile, preload]);

  useEffect(() => {
    if (fallback) return;
    const coarse = saveData
      ? [frontFrame, Math.max(0, frontFrame - 5), Math.min(frames.length - 1, frontFrame + 5)]
      : [0, 5, 10, frontFrame, 20, 25, frames.length - 1];
    const coarseTimer = window.setTimeout(() => coarse.forEach((index) => void preload(index)), 120);
    const idleId = !saveData ? requestIdle(async () => {
      const order = frames.map((_, index) => index).sort((a, b) => Math.abs(a - currentFrame) - Math.abs(b - currentFrame));
      for (const index of order) await preload(index);
    }) : 0;
    return () => {
      window.clearTimeout(coarseTimer);
      if (typeof window.cancelIdleCallback === 'function' && idleId) window.cancelIdleCallback(idleId);
      else if (idleId) window.clearTimeout(idleId);
    };
  }, [currentFrame, fallback, frames, frontFrame, preload, saveData]);

  useEffect(() => {
    if (!selected || saveData || fallback || !frames[currentFrame]) return;
    const timer = window.setTimeout(() => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = async () => {
        try { await image.decode?.(); } catch { /* onload remains a safe readiness signal */ }
        setHiReady((value) => new Set(value).add(currentFrame));
      };
      image.src = frames[currentFrame].beautyHi;
    }, 900);
    return () => window.clearTimeout(timer);
  }, [currentFrame, fallback, frames, saveData, selected]);

  useEffect(() => () => cache.current.clear(), []);

  return {
    frameReady: fallback || ready.has(currentFrame),
    hiReady: hiReady.has(currentFrame),
    preload,
  };
}
