import manifestJson from '../generated/sequence-manifest.json';

export type RegionManifest = {
  level: number;
  bounds: [number, number, number, number];
  centroid: [number, number];
  pixelCount: number;
  componentCount: number;
  alphaMask: string;
};

export type SequenceFrame = {
  id: number;
  angle: number;
  beautySmall: string;
  beautySmallFallback: string;
  beautyMedium: string;
  beautyMediumFallback: string;
  beautyHi: string;
  sourceWidth: number;
  sourceHeight: number;
  hitMap: string;
  hitMapWidth: number;
  hitMapHeight: number;
  regions: Record<string, RegionManifest>;
  detectedBandCount: number;
  detectedComponentCount: number;
};

export type SequenceManifest = {
  generatedAt: string;
  sourceDimensions: { width: number; height: number };
  frames: SequenceFrame[];
  frontFrame: number;
  levels: string[];
  plans: Record<string, string>;
  warnings: string[];
};

export const sequenceManifest = manifestJson as unknown as SequenceManifest;

export function closestFrameForAngle(angle: number) {
  return sequenceManifest.frames.reduce((best, frame) =>
    Math.abs(frame.angle - angle) < Math.abs(best.angle - angle) ? frame : best,
  sequenceManifest.frames[sequenceManifest.frontFrame]);
}

export function regionKey(level: number) {
  return String(level).padStart(2, '0');
}
