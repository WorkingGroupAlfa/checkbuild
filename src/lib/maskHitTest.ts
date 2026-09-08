export function decodeHitPixel(pixel: Uint8ClampedArray) {
  return pixel[3] > 0 && pixel[1] === 71 ? pixel[0] : null;
}

export function readHitLevel(
  canvas: HTMLCanvasElement,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
) {
  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(sourceX / sourceWidth * canvas.width)));
  const y = Math.min(canvas.height - 1, Math.max(0, Math.floor(sourceY / sourceHeight * canvas.height)));
  return decodeHitPixel(canvas.getContext('2d', { willReadFrequently: true })!.getImageData(x, y, 1, 1).data);
}
