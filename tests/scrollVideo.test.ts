// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachScrollVideo } from '../src/lib/scrollVideo';

let story: HTMLDivElement;
let video: HTMLVideoElement;
let media: { time: number; ready: number; seeking: boolean; duration: number; top: number; hidden: boolean };
let motion: MediaQueryList;
let frames: Map<number, FrameRequestCallback>;
let seek: ReturnType<typeof vi.fn>;
let play: ReturnType<typeof vi.fn>;
let pause: ReturnType<typeof vi.fn>;
let cleanup: (() => void) | undefined;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  const queued = [...frames.values()];
  frames.clear();
  queued.forEach(callback => callback(0));
};
const scroll = (top: number) => {
  media.top = top;
  window.dispatchEvent(new Event('scroll'));
};
const finishSeek = () => {
  media.seeking = false;
  video.dispatchEvent(new Event('seeked'));
};
const setMotion = (matches: boolean) => {
  Object.defineProperty(motion, 'matches', { value: matches, configurable: true });
  motion.dispatchEvent(new Event('change'));
};

beforeEach(() => {
  frames = new Map();
  media = { time: 0, ready: 2, seeking: false, duration: 4, top: 0, hidden: false };
  story = document.createElement('div');
  const viewport = document.createElement('div');
  video = document.createElement('video');
  viewport.append(video);
  story.append(viewport);
  document.body.append(story);
  Object.defineProperty(story, 'offsetHeight', { value: 1800 });
  Object.defineProperty(viewport, 'clientHeight', { value: 900 });
  vi.spyOn(story, 'getBoundingClientRect').mockImplementation(() => ({ top: media.top, bottom: media.top + 1800 } as DOMRect));
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => media.hidden);
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  motion = new EventTarget() as MediaQueryList;
  Object.defineProperty(motion, 'matches', { value: false, configurable: true });
  vi.stubGlobal('matchMedia', () => motion);
  seek = vi.fn((time: number) => { media.time = time; media.seeking = true; });
  Object.defineProperties(video, {
    duration: { get: () => media.duration },
    readyState: { get: () => media.ready },
    seeking: { get: () => media.seeking },
    currentTime: { get: () => media.time, set: (time: number) => seek(time) },
  });
  play = vi.spyOn(video, 'play').mockResolvedValue(undefined);
  pause = vi.spyOn(video, 'pause').mockImplementation(() => {});
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scroll video media lifecycle', () => {
  it('recovers from denied autoplay directly in a touch handler without blocking scrolling', async () => {
    play.mockRejectedValueOnce(new DOMException('Gesture required', 'NotAllowedError'));
    cleanup = attachScrollVideo(story, video);
    await flush();
    for (let i = 0; i < 20; i++) { scroll(-450); await flush(); }
    expect(play).toHaveBeenCalledTimes(1);
    expect(seek).not.toHaveBeenCalled();
    expect(video.dataset.ready).toBeUndefined();
    const touch = new Event('touchend', { cancelable: true });
    window.dispatchEvent(touch);
    expect(play).toHaveBeenCalledTimes(2); // Must happen synchronously in the gesture.
    expect(touch.defaultPrevented).toBe(false);
    await flush();
    expect(pause).toHaveBeenCalledTimes(1);
    expect(media.time).toBeCloseTo(1.9825);
    expect(video.dataset.ready).toBe('true');
    expect(video.muted && video.defaultMuted && video.playsInline).toBe(true);
  });

  it('waits for decoded data after metadata and catches up without another scroll', async () => {
    media.ready = 1;
    cleanup = attachScrollVideo(story, video);
    scroll(-450);
    video.dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(seek).not.toHaveBeenCalled();
    expect(video.dataset.ready).toBeUndefined();
    media.ready = 2;
    video.dispatchEvent(new Event('loadeddata'));
    await flush();
    expect(media.time).toBeCloseTo(1.9825);
  });

  it('finishes the current seek before applying the latest scroll position in either direction', async () => {
    cleanup = attachScrollVideo(story, video);
    await flush();
    scroll(-200);
    await flush();
    const first = media.time;
    for (const top of [-600, -700, -800, -100]) { scroll(top); await flush(); }
    expect(seek).toHaveBeenCalledTimes(1);
    expect(media.time).toBe(first);
    finishSeek();
    await flush();
    expect(seek).toHaveBeenCalledTimes(2);
    expect(media.time).toBeCloseTo(3.965 / 9);
    finishSeek();
    await flush();
    expect(frames.size).toBe(0);
    expect(seek).toHaveBeenCalledTimes(2);
  });

  it('retries a temporarily unavailable seek when media readiness returns', async () => {
    seek.mockImplementationOnce(() => { throw new DOMException('Not seekable', 'InvalidStateError'); });
    cleanup = attachScrollVideo(story, video);
    scroll(-450);
    await flush();
    expect(media.time).toBe(0);
    video.dispatchEvent(new Event('canplay'));
    await flush();
    expect(media.time).toBeCloseTo(1.9825);
  });

  it('respects reduced motion initially and when the setting changes', async () => {
    setMotion(true);
    cleanup = attachScrollVideo(story, video);
    scroll(-450);
    window.dispatchEvent(new Event('touchend'));
    await flush();
    expect(play).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
    setMotion(false);
    await flush();
    expect(video.dataset.ready).toBe('true');
    setMotion(true);
    expect(video.dataset.ready).toBeUndefined();
    expect(frames.size).toBe(0);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it('reinitializes a suspended tab, including one restored below the story', async () => {
    cleanup = attachScrollVideo(story, video);
    await flush();
    media.hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    media.top = -2000;
    media.hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    scroll(-450);
    await flush();
    expect(play).toHaveBeenCalledTimes(2);
    expect(media.time).toBeCloseTo(1.9825);
  });

  it('allows a real gesture to retry while an automatic play promise is still pending', async () => {
    let resolveInitial!: () => void;
    play.mockImplementationOnce(() => new Promise<void>(resolve => { resolveInitial = resolve; }));
    cleanup = attachScrollVideo(story, video);
    window.dispatchEvent(new Event('touchend'));
    await flush();
    expect(play).toHaveBeenCalledTimes(2);
    expect(video.dataset.ready).toBe('true');
    resolveInitial();
    await flush();
    expect(pause).toHaveBeenCalledTimes(1);
  });

  it('disposes listeners and ignores a late play result', async () => {
    let resolve!: () => void;
    play.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    cleanup = attachScrollVideo(story, video);
    cleanup();
    cleanup = undefined;
    resolve();
    window.dispatchEvent(new Event('touchend'));
    scroll(-450);
    video.dispatchEvent(new Event('canplay'));
    await flush();
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(video.dataset.ready).toBeUndefined();
    expect(seek).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('falls back to the poster on a video or source error', async () => {
    cleanup = attachScrollVideo(story, video);
    await flush();
    expect(video.dataset.ready).toBe('true');
    const source = document.createElement('source');
    video.append(source);
    source.dispatchEvent(new Event('error'));
    expect(video.dataset.ready).toBeUndefined();
    expect(frames.size).toBe(0);
  });
});
it('keeps the poster until the decoder submits a frame, even after play resolves', async () => {
  let onFrame!: VideoFrameRequestCallback;
  video.requestVideoFrameCallback = vi.fn(callback => { onFrame = callback; return 1; });
  video.cancelVideoFrameCallback = vi.fn();
  cleanup = attachScrollVideo(story, video);
  await flush();
  expect(video.dataset.ready).toBeUndefined();
  expect(pause).not.toHaveBeenCalled();
  onFrame(0, {} as VideoFrameCallbackMetadata);
  await flush();
  expect(video.dataset.ready).toBe('true');
  expect(pause).toHaveBeenCalledTimes(1);
});

it('cancels a pending decoder callback on unmount', async () => {
  video.requestVideoFrameCallback = vi.fn(() => 42);
  video.cancelVideoFrameCallback = vi.fn();
  cleanup = attachScrollVideo(story, video);
  await flush();
  cleanup();
  cleanup = undefined;
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(42);
  expect(video.dataset.ready).toBeUndefined();
});