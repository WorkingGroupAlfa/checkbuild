/** Bounded LRU of decoded images. Encoded bytes are owned separately. */
export class FrameCache<Key = number> {
  private entries = new Map<Key, HTMLImageElement>();

  constructor(private readonly maximum = 9) {}

  get(frame: Key) {
    const image = this.entries.get(frame);
    if (image) {
      this.entries.delete(frame);
      this.entries.set(frame, image);
    }
    return image;
  }

  peek(frame: Key) { return this.entries.get(frame); }

  set(frame: Key, image: HTMLImageElement) {
    this.entries.delete(frame);
    this.entries.set(frame, image);
    while (this.entries.size > this.maximum) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      const oldImage = this.entries.get(oldest.value)!;
      // Dropping our reference must not trigger an error/fallback or invalidate
      // an image still used by the visible frame or an overlay.
      oldImage.onload = null;
      oldImage.onerror = null;
      this.entries.delete(oldest.value);
    }
  }

  clear() {
    for (const image of this.entries.values()) {
      image.onload = null;
      image.onerror = null;
    }
    this.entries.clear();
  }
}
