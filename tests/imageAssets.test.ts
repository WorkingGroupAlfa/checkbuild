// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageAssets } from '../src/lib/imageAssets';
import { FrameCache } from '../src/lib/frameCache';

let blobs: Map<string, Blob>;
let images: MockImage[];
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  complete = false;
  naturalWidth = 0;
  private source = '';
  constructor() { images.push(this); }
  get src() { return this.source; }
  set src(value: string) {
    this.source = value;
    queueMicrotask(() => {
      if (this.source !== value) return;
      this.complete = true;
      this.naturalWidth = value && blobs.get(value)?.type !== 'image/broken' ? 1200 : 0;
      if (this.naturalWidth) this.onload?.();
      else this.onerror?.();
    });
  }
  decode() { return Promise.resolve(); }
  removeAttribute() { this.src = ''; }
}
const response = (type = 'image/webp') => ({ ok: true, status: 200, blob: async () => new Blob(['image'], { type }) });

beforeEach(() => {
  blobs = new Map();
  images = [];
  let id = 0;
  vi.stubGlobal('Image', MockImage);
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = vi.fn((blob: Blob) => { const url = 'blob:test-' + ++id; blobs.set(url, blob); return url; });
    static revokeObjectURL = vi.fn((url: string) => blobs.delete(url));
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('image asset lifetime and cache', () => {
  it('evicts decoded images without triggering fallback and keeps compressed bytes reusable', async () => {
    const assets = new ImageAssets(2);
    const first = await assets.load('/a.webp', '/a.jpg');
    await assets.load('/b.webp');
    await assets.load('/c.webp');
    expect(assets.peek('/a.webp')).toBeUndefined();
    expect(first.image.src).toBe(first.url);
    expect(first.image.onload).toBeNull();
    expect(first.image.onerror).toBeNull();
    const decodedAgain = await assets.load('/a.webp', '/a.jpg');
    expect(decodedAgain.url).toBe(first.url);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(images).toHaveLength(4);
    assets.dispose();
    expect(blobs.size).toBe(0);
  });

  it('touches recently used frames when deciding which decoded image to evict', () => {
    const cache = new FrameCache<string>(2);
    const [a, b, c] = [new Image(), new Image(), new Image()];
    cache.set('a', a); cache.set('b', b);
    expect(cache.get('a')).toBe(a);
    cache.set('c', c);
    expect(cache.peek('a')).toBe(a);
    expect(cache.peek('b')).toBeUndefined();
  });

  it('downloads background frames without decoding and deduplicates foreground requests', async () => {
    const assets = new ImageAssets();
    await assets.prefetch('/a.webp');
    expect(images).toHaveLength(0);
    const [first, second] = await Promise.all([assets.load('/a.webp'), assets.load('/a.webp')]);
    expect(first.image).toBe(second.image);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(images).toHaveLength(1);
    assets.dispose();
  });

  it('uses JPEG once when WebP fails and never resurrects it after eviction', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => (String(url).endsWith('.webp') ? { ok: false, status: 404 } : response('image/jpeg')) as Response);
    const assets = new ImageAssets(1);
    const first = await assets.load('/a.webp', '/a.jpg');
    expect(first.source).toBe('/a.jpg');
    await assets.load('/b.jpg');
    await assets.load('/a.webp', '/a.jpg');
    expect(fetch).toHaveBeenCalledTimes(3);
    assets.dispose();
    await Promise.resolve();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('also recovers when HTTP succeeds but the WebP cannot be decoded', async () => {
    vi.mocked(fetch).mockImplementation(async (url) => response(String(url).endsWith('.webp') ? 'image/broken' : 'image/jpeg') as Response);
    const assets = new ImageAssets();
    expect((await assets.load('/broken.webp', '/fallback.jpg')).source).toBe('/fallback.jpg');
    expect(fetch).toHaveBeenCalledTimes(2);
    assets.dispose();
    expect(blobs.size).toBe(0);
  });

  it('stops retrying permanent failures until explicitly retried', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503 } as Response);
    const assets = new ImageAssets();
    await expect(assets.load('/a.webp', '/a.jpg')).rejects.toThrow();
    await expect(assets.load('/a.webp', '/a.jpg')).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(assets.hasFailed('/a.webp')).toBe(true);
    assets.resetFailures();
    vi.mocked(fetch).mockResolvedValue(response() as Response);
    await assets.load('/a.webp', '/a.jpg');
    expect(fetch).toHaveBeenCalledTimes(3);
    assets.dispose();
  });

  it('does not repeatedly decode corrupt WebP and JPEG responses', async () => {
    vi.mocked(fetch).mockResolvedValue(response('image/broken') as Response);
    const assets = new ImageAssets();
    await expect(assets.load('/broken.webp', '/broken.jpg')).rejects.toThrow();
    await expect(assets.load('/broken.webp', '/broken.jpg')).rejects.toThrow();
    expect(images).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    assets.dispose();
  });

  it('does not retain image bytes that finish after disposal', async () => {
    let finish!: (value: Blob) => void;
    vi.mocked(fetch).mockResolvedValue({ ok: true, blob: () => new Promise(resolve => { finish = resolve; }) } as Response);
    const assets = new ImageAssets();
    const pending = assets.load('/late.webp').catch(error => error);
    await vi.waitFor(() => expect(finish).toBeDefined());
    assets.dispose();
    finish(new Blob(['late']));
    expect((await pending).name).toBe('AbortError');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(assets.hasBytes('/late.webp')).toBe(false);
  });

  it('limits concurrency and prioritizes a requested frame over queued background work', async () => {
    let release!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const assets = new ImageAssets(2, 1);
    const first = assets.prefetch('/first.webp', undefined, 20);
    const background = assets.prefetch('/background.webp', undefined, 20);
    const foreground = assets.load('/target.webp', undefined, -10);
    expect(fetch).toHaveBeenCalledTimes(1);
    release(response() as Response);
    await Promise.all([first, background, foreground]);
    expect(vi.mocked(fetch).mock.calls.map(call => call[0])).toEqual(['/first.webp', '/target.webp', '/background.webp']);
    assets.dispose();
  });

  it('aborts active requests and rejects queued work when unmounted', async () => {
    let aborted = false;
    vi.mocked(fetch).mockImplementation((_source, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => { aborted = true; reject(new DOMException('Aborted', 'AbortError')); });
    }));
    const assets = new ImageAssets(2, 1);
    const first = assets.load('/a.webp').catch(error => error);
    const queued = assets.load('/b.webp').catch(error => error);
    assets.dispose();
    expect((await first).name).toBe('AbortError');
    expect((await queued).name).toBe('AbortError');
    expect(aborted).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(assets.peek('/a.webp')).toBeUndefined();
    await expect(assets.load('/c.webp')).rejects.toMatchObject({ name: 'AbortError' });
  });
});
