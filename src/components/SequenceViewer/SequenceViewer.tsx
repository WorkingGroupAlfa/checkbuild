import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Suite } from '../../data/spaces';
import { usePointerScrub } from '../../hooks/usePointerScrub';
import { useSequenceLoader } from '../../hooks/useSequenceLoader';
import { getContainRect, pointerToSource } from '../../lib/imageFit';
import { readHitLevel } from '../../lib/maskHitTest';
import { regionKey, sequenceManifest } from '../../lib/assetManifest';
import { ArrowIcon } from '../ArrowIcon/ArrowIcon';

type Props = {
  currentFrame: number;
  selectedLevel: number | null;
  hoveredLevel: number | null;
  units: Suite[];
  fallback: boolean;
  onFrameChange: (frame: number) => void;
  onSelectLevel: (level: number | null) => void;
  onHoverLevel: (level: number | null) => void;
  onSelectUnit: (unitId: string) => void;
};

type LoadedMask = { frame: number; level: number; image: HTMLImageElement } | null;

function hasRotatedBefore() {
  try { return localStorage.getItem('collins-rotated') === '1'; }
  catch { return false; }
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* onload is sufficient on older engines */ }
      resolve(image);
    };
    image.onerror = reject;
    image.src = source;
  });
}

function waitForAnimationFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

type BeautyTarget = { key: string; frame: (typeof sequenceManifest.frames)[number]; hi: boolean };

function BeautyPicture({
  target,
  role,
  animate = false,
  onReady,
}: {
  target: BeautyTarget;
  role: 'active' | 'outgoing' | 'incoming';
  animate?: boolean;
  onReady?: () => void;
}) {
  const { frame, hi } = target;
  const [useFallback, setUseFallback] = useState(false);
  const reportedReady = useRef(false);
  const webp = hi ? frame.beautyHi : frame.beautyMedium;
  const fallback = window.matchMedia('(max-width: 720px)').matches
    ? frame.beautySmallFallback
    : frame.beautyMediumFallback;
  const hidden = role !== 'active';
  return (
    <div
      className={`beauty-frame is-${role}${animate ? ' is-revealing' : ''}`}
      data-frame={frame.id}
      data-quality={hi ? 'hi' : 'normal'}
      aria-hidden={hidden || undefined}
    >
      <picture>
        {!useFallback && !hi && <source media="(max-width: 720px)" type="image/webp" srcSet={frame.beautySmall} />}
        {!useFallback && <source type="image/webp" srcSet={webp} />}
        <img
          src={fallback}
          alt={hidden ? '' : '470 Collins Street viewed from Collins Street'}
          width="1200"
          height="1500"
          draggable={false}
          decoding="async"
          fetchPriority={frame.id === sequenceManifest.frontFrame ? 'high' : 'auto'}
          onLoad={async (event) => {
            if (!onReady || reportedReady.current) return;
            const image = event.currentTarget;
            try { await image.decode?.(); } catch { /* complete + naturalWidth is checked below */ }
            if (!image.isConnected || !image.complete || image.naturalWidth === 0) return;
            await waitForAnimationFrame();
            if (!image.isConnected || !image.complete || image.naturalWidth === 0 || reportedReady.current) return;
            reportedReady.current = true;
            onReady();
          }}
          onError={() => { if (!useFallback) setUseFallback(true); }}
        />
      </picture>
    </div>
  );
}

function BufferedBeauty({
  frame,
  hi,
  allowPromotion,
  onDisplayed,
}: {
  frame: BeautyTarget['frame'];
  hi: boolean;
  allowPromotion: boolean;
  onDisplayed: (frame: number) => void;
}) {
  const makeTarget = useCallback((nextFrame: BeautyTarget['frame'], nextHi: boolean): BeautyTarget => ({
    key: `${nextFrame.id}-${nextHi ? 'hi' : 'normal'}`,
    frame: nextFrame,
    hi: nextHi,
  }), []);
  const [active, setActive] = useState(() => makeTarget(frame, hi));
  const [outgoing, setOutgoing] = useState<BeautyTarget | null>(null);
  const [incoming, setIncoming] = useState<BeautyTarget | null>(null);
  const activeRef = useRef(active);
  const outgoingRef = useRef<BeautyTarget | null>(null);
  const incomingRef = useRef<BeautyTarget | null>(null);
  const readyIncomingKey = useRef<string | null>(null);
  const transitionTimer = useRef(0);

  const promote = useCallback((target: BeautyTarget) => {
    window.clearTimeout(transitionTimer.current);
    const previousActive = activeRef.current;
    outgoingRef.current = previousActive;
    setOutgoing(previousActive);
    activeRef.current = target;
    setActive(target);
    incomingRef.current = null;
    readyIncomingKey.current = null;
    setIncoming(null);
    onDisplayed(target.frame.id);
    transitionTimer.current = window.setTimeout(() => {
      if (outgoingRef.current?.key === previousActive.key) {
        outgoingRef.current = null;
        setOutgoing(null);
      }
    }, 80);
  }, [onDisplayed]);

  useLayoutEffect(() => {
    const target = makeTarget(frame, hi);
    if (target.key === activeRef.current.key) {
      incomingRef.current = null;
      readyIncomingKey.current = null;
      setIncoming(null);
      return;
    }
    if (target.key === outgoingRef.current?.key) {
      promote(target);
      return;
    }
    if (target.key === incomingRef.current?.key) return;
    readyIncomingKey.current = null;
    incomingRef.current = target;
    setIncoming(target);
  }, [frame, hi, makeTarget, promote]);

  useEffect(() => () => window.clearTimeout(transitionTimer.current), []);

  useEffect(() => {
    const ready = incomingRef.current;
    if (allowPromotion && ready && readyIncomingKey.current === ready.key) promote(ready);
  }, [allowPromotion, promote]);

  const handleIncomingReady = (key: string) => {
    const ready = incomingRef.current;
    if (ready?.key !== key) return;
    readyIncomingKey.current = key;
    if (allowPromotion) promote(ready);
  };

  return (
    <>
      {outgoing && <BeautyPicture key={outgoing.key} target={outgoing} role="outgoing" />}
      <BeautyPicture key={active.key} target={active} role="active" animate={outgoing !== null} />
      {incoming && (
        <BeautyPicture
          key={incoming.key}
          target={incoming}
          role="incoming"
          onReady={() => handleIncomingReady(incoming.key)}
        />
      )}
    </>
  );
}

function drawMaskOutline(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  dpr: number,
) {
  const margin = 3;
  const scratch = document.createElement('canvas');
  scratch.width = Math.ceil((width + margin * 2) * dpr);
  scratch.height = Math.ceil((height + margin * 2) * dpr);
  const ring = scratch.getContext('2d')!;
  ring.setTransform(dpr, 0, 0, dpr, 0, 0);
  const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [dx, dy] of offsets) ring.drawImage(image, margin + dx, margin + dy, width, height);
  ring.globalCompositeOperation = 'destination-out';
  ring.drawImage(image, margin, margin, width, height);
  ring.globalCompositeOperation = 'source-in';
  ring.fillStyle = color;
  ring.fillRect(0, 0, scratch.width / dpr, scratch.height / dpr);
  context.drawImage(scratch, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

export function SequenceViewer({
  currentFrame,
  selectedLevel,
  hoveredLevel,
  units,
  fallback,
  onFrameChange,
  onSelectLevel,
  onHoverLevel,
  onSelectUnit,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const hitCanvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRaf = useRef<number | null>(null);
  const maskCache = useRef(new Map<string, HTMLImageElement>());
  const maskPending = useRef(new Map<string, Promise<HTMLImageElement>>());
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [hitReadyFrame, setHitReadyFrame] = useState<number | null>(null);
  const [selectedMask, setSelectedMask] = useState<LoadedMask>(null);
  const [hoverMask, setHoverMask] = useState<LoadedMask>(null);
  const [readyMaskKeys, setReadyMaskKeys] = useState<Set<string>>(() => new Set());
  const [showHint, setShowHint] = useState(() => !hasRotatedBefore());
  const [visualFrame, setVisualFrame] = useState(fallback ? sequenceManifest.frontFrame : currentFrame);
  const motionFrame = fallback || visualFrame === currentFrame
    ? (fallback ? sequenceManifest.frontFrame : currentFrame)
    : visualFrame + Math.sign(currentFrame - visualFrame);
  const { frameReady, hiReady } = useSequenceLoader(
    sequenceManifest.frames,
    sequenceManifest.frontFrame,
    motionFrame,
    selectedLevel !== null,
    fallback,
  );
  const requestedFrame = frameReady ? motionFrame : visualFrame;
  const frame = sequenceManifest.frames[visualFrame];
  const requestedBeautyFrame = sequenceManifest.frames[requestedFrame];
  const requestedSelectionRegion = selectedLevel === null
    ? null
    : requestedBeautyFrame.regions[regionKey(selectedLevel)] ?? null;
  const requestedMaskKey = requestedSelectionRegion && selectedLevel !== null
    ? `${requestedFrame}:${selectedLevel}:${requestedSelectionRegion.alphaMask}`
    : null;
  const canShowRequestedFrame = requestedMaskKey === null || readyMaskKeys.has(requestedMaskKey);
  const contain = useMemo(() => getContainRect(
    size.width,
    size.height,
    sequenceManifest.sourceDimensions.width,
    sequenceManifest.sourceDimensions.height,
  ), [size]);
  const selectedRegion = selectedLevel === null ? null : frame.regions[regionKey(selectedLevel)] ?? null;
  const zoomOrigin = selectedRegion
    ? [contain.x + selectedRegion.centroid[0] * contain.scale, contain.y + selectedRegion.centroid[1] * contain.scale] as [number, number]
    : undefined;
  const zoomScale = selectedRegion ? 1.56 : 1;
  const unitAnchorStyle = selectedRegion ? {
    '--unit-anchor-x': `${contain.x + selectedRegion.centroid[0] * contain.scale}px`,
    '--unit-anchor-y': `${contain.y + selectedRegion.centroid[1] * contain.scale}px`,
  } as CSSProperties : undefined;

  const getMask = useCallback((frameIndex: number, level: number) => {
    const region = sequenceManifest.frames[frameIndex]?.regions[regionKey(level)];
    if (!region) return Promise.reject(new Error(`Missing mask for Level ${level}, frame ${frameIndex}.`));
    const key = `${frameIndex}:${level}:${region.alphaMask}`;
    const cached = maskCache.current.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = maskPending.current.get(key);
    if (pending) return pending;
    const promise = loadImage(region.alphaMask).then((image) => {
      maskCache.current.set(key, image);
      setReadyMaskKeys((value) => new Set(value).add(key));
      maskPending.current.delete(key);
      return image;
    }).catch((error) => { maskPending.current.delete(key); throw error; });
    maskPending.current.set(key, promise);
    return promise;
  }, []);

  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setHitReadyFrame(null);
    const hitCanvas = hitCanvasRef.current;
    if (!hitCanvas) return;
    let active = true;
    loadImage(frame.hitMap).then((image) => {
      if (!active) return;
      hitCanvas.width = frame.hitMapWidth;
      hitCanvas.height = frame.hitMapHeight;
      const context = hitCanvas.getContext('2d', { willReadFrequently: true })!;
      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, hitCanvas.width, hitCanvas.height);
      context.drawImage(image, 0, 0);
      setHitReadyFrame(visualFrame);
    }).catch(() => setHitReadyFrame(null));
    return () => { active = false; };
  }, [frame.hitMap, frame.hitMapHeight, frame.hitMapWidth, visualFrame]);

  useLayoutEffect(() => {
    if (selectedLevel === null) return;
    const region = frame.regions[regionKey(selectedLevel)];
    if (!region) return;
    const cached = maskCache.current.get(`${visualFrame}:${selectedLevel}:${region.alphaMask}`);
    if (cached) {
      setSelectedMask({ frame: visualFrame, level: selectedLevel, image: cached });
      return;
    }
    setSelectedMask(null);
    let active = true;
    getMask(visualFrame, selectedLevel).then((image) => {
      if (active) setSelectedMask({ frame: visualFrame, level: selectedLevel, image });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [frame.regions, getMask, selectedLevel, visualFrame]);

  useEffect(() => {
    if (selectedLevel === null) return;
    const order = sequenceManifest.frames
      .map((_, index) => index)
      .sort((left, right) => Math.abs(left - visualFrame) - Math.abs(right - visualFrame));
    for (const index of order) void getMask(index, selectedLevel).catch(() => undefined);
  }, [getMask, selectedLevel, visualFrame]);

  useLayoutEffect(() => {
    if (hoveredLevel === null || hoveredLevel === selectedLevel) return;
    const region = frame.regions[regionKey(hoveredLevel)];
    if (!region) return;
    const cached = maskCache.current.get(`${visualFrame}:${hoveredLevel}:${region.alphaMask}`);
    if (cached) {
      setHoverMask({ frame: visualFrame, level: hoveredLevel, image: cached });
      return;
    }
    setHoverMask(null);
    let active = true;
    getMask(visualFrame, hoveredLevel).then((image) => {
      if (active) setHoverMask({ frame: visualFrame, level: hoveredLevel, image });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [frame.regions, getMask, hoveredLevel, selectedLevel, visualFrame]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(size.width * dpr));
    canvas.height = Math.max(1, Math.round(size.height * dpr));
    const context = canvas.getContext('2d')!;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);

    if (selectedLevel !== null && selectedRegion) {
      context.fillStyle = 'rgba(17, 17, 17, 0.52)';
      context.fillRect(contain.x, contain.y, contain.width, contain.height);
    }

    if (selectedMask?.frame === visualFrame && selectedMask.level === selectedLevel && selectedRegion) {
      const [sourceX, sourceY, sourceWidth, sourceHeight] = selectedRegion.bounds;
      const x = contain.x + sourceX * contain.scale;
      const y = contain.y + sourceY * contain.scale;
      const width = sourceWidth * contain.scale;
      const height = sourceHeight * contain.scale;
      context.globalCompositeOperation = 'destination-out';
      context.drawImage(selectedMask.image, x, y, width, height);
      context.globalCompositeOperation = 'source-over';
      drawMaskOutline(context, selectedMask.image, x, y, width, height, '#fff', dpr);
    }

    if (hoverMask?.frame === visualFrame && hoverMask.level === hoveredLevel) {
      const region = frame.regions[regionKey(hoverMask.level)];
      const [sourceX, sourceY, sourceWidth, sourceHeight] = region.bounds;
      drawMaskOutline(
        context,
        hoverMask.image,
        contain.x + sourceX * contain.scale,
        contain.y + sourceY * contain.scale,
        sourceWidth * contain.scale,
        sourceHeight * contain.scale,
        '#fff',
        dpr,
      );
    }
  }, [contain, frame.regions, hoverMask, hoveredLevel, selectedLevel, selectedMask, selectedRegion, size, visualFrame]);

  const hitAt = useCallback((clientX: number, clientY: number) => {
    const viewport = viewportRef.current;
    const hitCanvas = hitCanvasRef.current;
    if (!viewport || !hitCanvas || hitReadyFrame !== visualFrame) return null;
    const sourcePoint = pointerToSource(
      clientX,
      clientY,
      viewport.getBoundingClientRect(),
      contain,
      frame.sourceWidth,
      frame.sourceHeight,
      zoomScale,
      zoomOrigin,
    );
    return sourcePoint
      ? readHitLevel(hitCanvas, sourcePoint.x, sourcePoint.y, frame.sourceWidth, frame.sourceHeight)
      : null;
  }, [contain, frame.sourceHeight, frame.sourceWidth, hitReadyFrame, visualFrame, zoomOrigin, zoomScale]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try { localStorage.setItem('collins-rotated', '1'); } catch { /* Storage may be disabled. */ }
  }, []);
  const onTap = useCallback((x: number, y: number) => {
    const level = hitAt(x, y);
    if (level !== null) onSelectLevel(level);
  }, [hitAt, onSelectLevel]);
  const scrub = usePointerScrub({
    frame: currentFrame,
    maximum: sequenceManifest.frames.length - 1,
    disabled: fallback,
    onFrame: onFrameChange,
    onTap,
    onFirstScrub: dismissHint,
  });

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    scrub.pointerHandlers.onPointerMove(event);
    if (scrub.dragging || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (hoverRaf.current !== null) cancelAnimationFrame(hoverRaf.current);
    const x = event.clientX;
    const y = event.clientY;
    hoverRaf.current = requestAnimationFrame(() => onHoverLevel(hitAt(x, y)));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!fallback && event.key === 'ArrowLeft') { event.preventDefault(); onFrameChange(Math.max(0, currentFrame - 1)); dismissHint(); }
    if (!fallback && event.key === 'ArrowRight') { event.preventDefault(); onFrameChange(Math.min(sequenceManifest.frames.length - 1, currentFrame + 1)); dismissHint(); }
    if (event.key === 'Escape') onSelectLevel(null);
  };

  return (
    <div
      ref={viewportRef}
      className={`sequence-viewer${scrub.dragging ? ' is-dragging' : ''}${selectedRegion ? ' is-zoomed' : ''}`}
      role="application"
      aria-label="Interactive building view. Use left and right arrow keys to rotate."
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={scrub.pointerHandlers.onPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={scrub.pointerHandlers.onPointerUp}
      onPointerCancel={scrub.pointerHandlers.onPointerCancel}
      onPointerLeave={() => onHoverLevel(null)}
      {...scrub.touchHandlers}
    >
      <div
        className="sequence-stage"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: zoomOrigin ? `${zoomOrigin[0]}px ${zoomOrigin[1]}px` : '50% 50%',
        }}
      >
        <img
          className="beauty-safety"
          src={sequenceManifest.frames[sequenceManifest.frontFrame].beautyMediumFallback}
          alt=""
          width="1200"
          height="1500"
          draggable={false}
          decoding="async"
          fetchPriority="high"
          aria-hidden="true"
        />
        <BufferedBeauty
          frame={requestedBeautyFrame}
          hi={requestedFrame === currentFrame && visualFrame === currentFrame && hiReady}
          allowPromotion={canShowRequestedFrame}
          onDisplayed={setVisualFrame}
        />
        <canvas ref={overlayRef} className="viewer-overlay" aria-hidden="true" />
      </div>
      <canvas ref={hitCanvasRef} className="hit-canvas" aria-hidden="true" />
      {selectedLevel !== null && (
        <button
          className="viewer-back viewer-level-back"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onClick={() => onSelectLevel(null)}
        >
          <span aria-hidden="true"><ArrowIcon direction="left" /></span>
          Back to building
        </button>
      )}
      {selectedLevel !== null && selectedRegion && (
        <div
          className={`unit-options-layer${units.length ? '' : ' is-empty'}`}
          style={unitAnchorStyle}
          role="region"
          aria-label={`Options on Level ${String(selectedLevel).padStart(2, '0')}`}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
        >
          {units.length > 0 ? (
            <>
              <div className="unit-options-label">
                <span>Available options</span>
                <b>{String(units.length).padStart(2, '0')}</b>
              </div>
              <div className="unit-option-list">
                {units.map((unit, index) => (
                  <button
                    className="unit-option"
                    type="button"
                    key={unit.id}
                    aria-label={`Open ${unit.name}, ${unit.area ?? 'area on request'}`}
                    onClick={() => onSelectUnit(unit.id)}
                  >
                    <span className="unit-option-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="unit-option-copy"><b>{unit.name}</b><small>{unit.area ?? 'Area on request'}</small></span>
                    <span className="unit-option-arrow" aria-hidden="true"><ArrowIcon direction="up-right" /></span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="unit-options-empty"><i aria-hidden="true" />No current options</div>
          )}
        </div>
      )}
      <div className={`rotation-hint${showHint && !fallback ? ' is-visible' : ''}`} aria-hidden="true">
        <span className="hint-line" />
        Drag to rotate
        <span className="hint-line" />
      </div>
    </div>
  );
}
