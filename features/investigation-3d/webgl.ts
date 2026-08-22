type CanvasLike = {
  getContext: (contextId: "webgl" | "experimental-webgl" | "webgl2") => unknown;
};

export function isWebGLAvailable(
  createCanvas: () => CanvasLike = () => document.createElement("canvas"),
): boolean {
  try {
    const canvas = createCanvas();
    return Boolean(
      canvas.getContext("webgl2") ??
        canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}
