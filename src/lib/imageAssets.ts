import { FrameCache } from './frameCache';

export type ImageAsset = { source: string; url: string; image: HTMLImageElement };
type EncodedAsset = { source: string; url: string };
type Download = { key: string; fallback?: string; priority: number; resolve: (asset: EncodedAsset) => void; reject: (error: unknown) => void };

const abortError = () => new DOMException('Image load cancelled', 'AbortError');

export function decodeImage(source: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    let decoding = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener('abort', cancel);
      if (error) { image.removeAttribute('src'); reject(error); }
      else resolve(image);
    };
    const cancel = () => finish(abortError());
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    image.decoding = 'async';
    image.onload = async () => {
      if (decoding || settled) return;
      decoding = true;
      try { await image.decode(); }
      catch { /* Some engines reject decode() even though onload succeeded. */ }
      if (!settled) finish(image.complete && image.naturalWidth > 0 ? undefined : new Error('Image could not be decoded'));
    };
    image.onerror = () => finish(new Error('Image could not be decoded'));
    image.src = source;
  });
}

/**
 * Keep compressed assets as object URLs for this viewer's lifetime, independent
 * of browser HTTP/decoded caches. Only a bounded working set remains decoded.
 */
export class ImageAssets {
  private encoded = new Map<string, EncodedAsset>();
  private decoded: FrameCache<string>;
  private downloads = new Map<string, Promise<EncodedAsset>>();
  private decoding = new Map<string, Promise<ImageAsset>>();
  private failures = new Map<string, unknown>();
  private queue: Download[] = [];
  private active = 0;
  private lifetime = new AbortController();

  constructor(decodedLimit = 9, private readonly concurrency = 3) {
    this.decoded = new FrameCache(decodedLimit);
  }

  hasBytes(key: string) { return this.encoded.has(key); }
  hasFailed(key: string) { return this.failures.has(key); }

  peek(key: string): ImageAsset | undefined {
    const image = this.decoded.peek(key);
    const asset = this.encoded.get(key);
    return image && asset ? { ...asset, image } : undefined;
  }

  resetFailures() { this.failures.clear(); }

  async prefetch(key: string, fallback?: string, priority = 10) {
    await this.bytes(key, fallback, priority);
  }

  load(key: string, fallback?: string, priority = 0): Promise<ImageAsset> {
    if (this.lifetime.signal.aborted) return Promise.reject(abortError());
    const cached = this.peek(key);
    if (cached) { this.decoded.get(key); return Promise.resolve(cached); }
    if (this.failures.has(key)) return Promise.reject(this.failures.get(key));
    const pending = this.decoding.get(key);
    if (pending) { this.promote(key, priority); return pending; }
    const promise = (async () => {
      let asset = await this.bytes(key, fallback, priority);
      let image: HTMLImageElement;
      try {
        image = await decodeImage(asset.url, this.lifetime.signal);
      } catch (error) {
        if (this.lifetime.signal.aborted || !fallback || asset.source === fallback) throw error;
        // Also recover from a successful HTTP response containing a corrupt WebP.
        const replacement = await this.bytes(fallback, undefined, priority);
        image = await decodeImage(replacement.url, this.lifetime.signal);
        URL.revokeObjectURL(asset.url);
        asset = replacement;
        this.encoded.set(key, asset);
      }
      if (this.lifetime.signal.aborted) throw abortError();
      this.decoded.set(key, image);
      return { ...asset, image };
    })().catch((error: unknown) => {
      if (!this.lifetime.signal.aborted) this.failures.set(key, error);
      throw error;
    }).finally(() => this.decoding.delete(key));
    this.decoding.set(key, promise);
    return promise;
  }

  dispose() {
    this.lifetime.abort();
    for (const task of this.queue.splice(0)) task.reject(abortError());
    this.decoded.clear();
    for (const url of new Set([...this.encoded.values()].map(asset => asset.url))) URL.revokeObjectURL(url);
    this.encoded.clear();
    this.failures.clear();
  }

  private promote(key: string, priority: number) {
    const queued = this.queue.find(task => task.key === key);
    if (queued) queued.priority = Math.min(queued.priority, priority);
  }

  private bytes(key: string, fallback?: string, priority = 0): Promise<EncodedAsset> {
    if (this.lifetime.signal.aborted) return Promise.reject(abortError());
    const cached = this.encoded.get(key);
    if (cached) return Promise.resolve(cached);
    if (this.failures.has(key)) return Promise.reject(this.failures.get(key));
    const pending = this.downloads.get(key);
    if (pending) { this.promote(key, priority); return pending; }
    const promise = new Promise<EncodedAsset>((resolve, reject) => {
      this.queue.push({ key, fallback, priority, resolve, reject });
    }).finally(() => this.downloads.delete(key));
    this.downloads.set(key, promise);
    this.pump();
    return promise;
  }

  private pump() {
    while (!this.lifetime.signal.aborted && this.active < this.concurrency && this.queue.length) {
      this.queue.sort((a, b) => a.priority - b.priority);
      const task = this.queue.shift()!;
      this.active += 1;
      void this.download(task).then(task.resolve, (error: unknown) => {
        if (!this.lifetime.signal.aborted) this.failures.set(task.key, error);
        task.reject(error);
      }).finally(() => { this.active -= 1; this.pump(); });
    }
  }

  private async download(task: Download): Promise<EncodedAsset> {
    let lastError: unknown;
    for (const source of [...new Set([task.key, task.fallback].filter((value): value is string => Boolean(value)))]) {
      if (this.lifetime.signal.aborted) throw abortError();
      const controller = new AbortController();
      const cancel = () => controller.abort();
      this.lifetime.signal.addEventListener('abort', cancel, { once: true });
      const timeout = globalThis.setTimeout(cancel, 15_000);
      try {
        // Runtime assets have content hashes, so force-cache cannot serve an old
        // revision even before the hosting header changes have been applied.
        const response = await fetch(source, { signal: controller.signal, cache: 'force-cache' });
        if (!response.ok) throw new Error('Image request failed: ' + response.status);
        const blob = await response.blob();
        if (this.lifetime.signal.aborted) throw abortError();
        const asset = { source, url: URL.createObjectURL(blob) };
        this.encoded.set(task.key, asset);
        return asset;
      } catch (error) {
        lastError = error;
      } finally {
        globalThis.clearTimeout(timeout);
        this.lifetime.signal.removeEventListener('abort', cancel);
      }
    }
    throw lastError;
  }
}
