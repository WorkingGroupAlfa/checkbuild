import { useEffect, useMemo, useRef, useState } from 'react';
import type { SequenceFrame } from '../lib/assetManifest';
import { ImageAssets, type ImageAsset } from '../lib/imageAssets';

export function useImageAssets(limit: number, concurrency: number) {
  const [assets, setAssets] = useState<ImageAssets | null>(null);
  useEffect(() => {
    const next = new ImageAssets(limit, concurrency);
    setAssets(next);
    return () => next.dispose();
  }, [limit, concurrency]);
  return assets;
}

export function useSequenceLoader(
  frames: SequenceFrame[],
  motionFrame: number,
  targetFrame: number,
  settledSelection: boolean,
  fallback: boolean,
) {
  const isMobile = useMemo(() => window.matchMedia('(max-width: 720px)').matches, []);
  const assets = useImageAssets(isMobile ? 7 : 9, 3);
  const saveData = navigator.connection?.saveData === true;
  const latestTarget = useRef(targetFrame);
  latestTarget.current = targetFrame;
  const [, setRevision] = useState(0);
  const [ready, setReady] = useState<{ index: number; asset: ImageAsset } | null>(null);
  const [hi, setHi] = useState<{ index: number; asset: ImageAsset } | null>(null);
  const normalSource = (index: number) => isMobile ? frames[index].beautySmall : frames[index].beautyMedium;
  const fallbackSource = (index: number) => isMobile ? frames[index].beautySmallFallback : frames[index].beautyMediumFallback;

  useEffect(() => {
    if (!assets) return;
    let active = true;
    const source = (index: number) => isMobile ? frames[index].beautySmall : frames[index].beautyMedium;
    const jpeg = (index: number) => isMobile ? frames[index].beautySmallFallback : frames[index].beautyMediumFallback;
    void assets.load(source(motionFrame), jpeg(motionFrame), -10).then(asset => {
      if (active) setReady({ index: motionFrame, asset });
    }).catch(() => { if (active) setRevision(value => value + 1); });
    if (!fallback) {
      const direction = Math.sign(targetFrame - motionFrame) || 1;
      const radius = isMobile || saveData ? 2 : 3;
      for (let distance = 1; distance <= radius; distance++) {
        for (const index of [motionFrame + direction * distance, motionFrame - direction * distance]) {
          if (frames[index]) void assets.load(source(index), jpeg(index), distance).catch(() => undefined);
        }
      }
      // Fetch the latest destination early, but don't decode distant images.
      void assets.prefetch(source(targetFrame), jpeg(targetFrame), -5).catch(() => undefined);
    }
    return () => { active = false; };
  }, [assets, fallback, frames, isMobile, motionFrame, saveData, targetFrame]);

  useEffect(() => {
    if (!assets || fallback || saveData) return;
    let active = true;
    const loadRemaining = async () => {
      while (active) {
        const next = frames.map((_, index) => index)
          .sort((a, b) => Math.abs(a - latestTarget.current) - Math.abs(b - latestTarget.current))
          .find(index => {
            const source = isMobile ? frames[index].beautySmall : frames[index].beautyMedium;
            return !assets.hasBytes(source) && !assets.hasFailed(source);
          });
        if (next === undefined) break;
        try {
          await assets.prefetch(isMobile ? frames[next].beautySmall : frames[next].beautyMedium,
            isMobile ? frames[next].beautySmallFallback : frames[next].beautyMediumFallback, 20);
        } catch { /* A failed frame must not stop the remaining sequence. */ }
      }
    };
    const timer = window.setTimeout(() => { void loadRemaining(); }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [assets, fallback, frames, isMobile, saveData]);

  useEffect(() => {
    setHi(null);
    if (!settledSelection || ready?.index !== targetFrame || saveData || fallback) return;
    // A separate lifetime makes a new gesture cancel an in-flight hi request.
    const highResolution = new ImageAssets(1, 1);
    let active = true;
    const timer = window.setTimeout(() => {
      void highResolution.load(frames[targetFrame].beautyHi).then(asset => {
        if (active) setHi({ index: targetFrame, asset });
      }).catch(() => undefined);
    }, 900);
    return () => { active = false; window.clearTimeout(timer); highResolution.dispose(); };
  }, [fallback, frames, ready?.index, saveData, settledSelection, targetFrame]);

  // Readiness describes a currently held image, not a historical "loaded" flag.
  const normal = ready?.index === motionFrame ? ready.asset : assets?.peek(normalSource(motionFrame));
  const failed = assets?.hasFailed(normalSource(motionFrame)) ?? false;
  const retry = () => {
    assets?.resetFailures();
    if (assets) void assets.load(normalSource(motionFrame), fallbackSource(motionFrame), -10)
      .then(asset => setReady({ index: motionFrame, asset }))
      .catch(() => setRevision(value => value + 1));
    setRevision(value => value + 1);
  };
  return { normal, hi: hi?.index === targetFrame && settledSelection ? hi.asset : undefined, failed, retry };
}
