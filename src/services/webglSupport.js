/**
 * Detect if the environment supports WebGL (for optional 3D garden walk).
 */
export function hasWebGLSupport() {
  if (typeof window === 'undefined' || !window.document) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (_) {
    return false;
  }
}
