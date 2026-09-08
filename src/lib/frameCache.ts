export class FrameCache {
  private entries = new Map<number, HTMLImageElement>();

  constructor(private readonly maximum = 5) {}

  set(frame: number, image: HTMLImageElement) {
    this.entries.delete(frame);
    this.entries.set(frame, image);
    while (this.entries.size > this.maximum) {
      const oldest = this.entries.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      const oldImage = this.entries.get(oldest);
      if (oldImage) oldImage.src = '';
      this.entries.delete(oldest);
    }
  }

  touch(frame: number) {
    const image = this.entries.get(frame);
    if (image) this.set(frame, image);
  }

  has(frame: number) {
    return this.entries.has(frame);
  }

  clear() {
    for (const image of this.entries.values()) image.src = '';
    this.entries.clear();
  }
}
