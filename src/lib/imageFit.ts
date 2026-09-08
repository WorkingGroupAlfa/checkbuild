export type ContainRect = { x: number; y: number; width: number; height: number; scale: number };

export function getContainRect(
  containerWidth: number,
  containerHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): ContainRect {
  const scale = Math.min(containerWidth / sourceWidth, containerHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
    scale,
  };
}

export function pointerToSource(
  clientX: number,
  clientY: number,
  elementRect: DOMRect,
  contain: ContainRect,
  sourceWidth: number,
  sourceHeight: number,
  zoomScale = 1,
  zoomOrigin?: [number, number],
) {
  let localX = clientX - elementRect.left;
  let localY = clientY - elementRect.top;
  if (zoomScale !== 1 && zoomOrigin) {
    localX = zoomOrigin[0] + (localX - zoomOrigin[0]) / zoomScale;
    localY = zoomOrigin[1] + (localY - zoomOrigin[1]) / zoomScale;
  }
  if (
    localX < contain.x || localY < contain.y ||
    localX > contain.x + contain.width || localY > contain.y + contain.height
  ) return null;
  return {
    x: Math.min(sourceWidth - 1, Math.max(0, Math.floor((localX - contain.x) / contain.width * sourceWidth))),
    y: Math.min(sourceHeight - 1, Math.max(0, Math.floor((localY - contain.y) / contain.height * sourceHeight))),
  };
}
