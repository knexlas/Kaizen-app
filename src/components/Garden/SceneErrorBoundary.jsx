import React from 'react';
import { Html } from '@react-three/drei';

/**
 * Error boundary used *inside* the R3F Canvas. Catches scene errors and
 * displays them via Html so we see what broke. R3F uses a separate React
 * tree inside Canvas, so the outer Garden3DErrorBoundary may not catch these.
 */
class SceneErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((s) => ({ ...s, errorInfo }));
    console.error('[Garden3D Scene] Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const { error, errorInfo } = this.state;
      return (
        <Html center>
          <div
            className="bg-stone-800/95 text-left rounded-xl shadow-xl p-4 max-w-md"
            style={{ minWidth: 280 }}
          >
            <div className="text-amber-400 font-semibold text-sm mb-2">🌱 Garden scene error</div>
            <pre className="bg-stone-900 text-red-300 text-xs p-3 rounded overflow-auto max-h-40 font-mono whitespace-pre-wrap break-words">
              {error?.message ?? String(error)}
            </pre>
            {errorInfo?.componentStack && (
              <details className="mt-2">
                <summary className="text-stone-400 text-xs cursor-pointer">Stack</summary>
                <pre className="mt-1 bg-stone-900 text-stone-500 text-xs p-2 rounded overflow-auto max-h-24 font-mono whitespace-pre-wrap">
                  {errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              type="button"
              onClick={() => this.setState({ error: null, errorInfo: null })}
              className="mt-3 px-3 py-1.5 bg-stone-600 hover:bg-stone-500 rounded text-xs text-white"
            >
              Try again
            </button>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

export default SceneErrorBoundary;
