import React from 'react';

/**
 * Error boundary for the 3D garden. Catches render errors and displays them
 * so we can see what's failing instead of a blank screen.
 */
class Garden3DErrorBoundary extends React.Component {
  state = { error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState((s) => ({ ...s, errorInfo }));
    console.error('[Garden3D] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      const { error, errorInfo } = this.state;
      return (
        <div className="relative w-full h-full min-h-[400px] rounded-2xl overflow-hidden bg-stone-800 flex flex-col items-center justify-center p-6 text-left">
          <div className="text-amber-400 font-semibold text-lg mb-2">🌱 Garden couldn&apos;t load</div>
          <pre className="bg-stone-900 text-red-300 text-xs p-4 rounded-lg overflow-auto max-h-48 w-full font-mono whitespace-pre-wrap break-words">
            {error?.message ?? String(error)}
          </pre>
          {errorInfo?.componentStack && (
            <details className="mt-3 w-full">
              <summary className="text-stone-400 text-sm cursor-pointer">Component stack</summary>
              <pre className="mt-1 bg-stone-900 text-stone-500 text-xs p-3 rounded overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                {errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            type="button"
            onClick={() => this.setState({ error: null, errorInfo: null })}
            className="mt-4 px-4 py-2 bg-stone-600 hover:bg-stone-500 rounded-lg text-sm text-white transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default Garden3DErrorBoundary;
