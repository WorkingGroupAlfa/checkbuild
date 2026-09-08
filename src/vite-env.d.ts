/// <reference types="vite/client" />

interface NetworkInformation {
  saveData?: boolean;
  effectiveType?: string;
}

interface Navigator {
  connection?: NetworkInformation;
}

interface Window {
  __viewerAudit: {
    samples: number;
    failures: Array<Record<string, unknown>>;
    frames: Set<string>;
    lastFrame: string | null;
    maxFrameJump: number;
  };
}
