import { Component } from 'react';

/**
 * Catches React render errors and shows a friendly fallback instead of a white screen.
 * Use once at the app root (e.g. in main.jsx) to protect the whole tree during beta.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { error, errorInfo } = this.state;
      let spiritEmoji = '🌸';
      try {
        const localData = localStorage.getItem('kaizen_garden_data');
        if (localData) {
          const parsed = JSON.parse(localData);
          if (parsed.spiritConfig && parsed.spiritConfig.emoji) {
            spiritEmoji = parsed.spiritConfig.emoji;
          }
        }
      } catch (e) {
        // Silently fallback if localStorage is corrupt
      }
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-stone-100">
          <div className="text-6xl mb-4" aria-hidden>{spiritEmoji}</div>
          <h1 className="font-serif text-xl text-stone-800 text-center mb-2">
            Oops! A vine got tangled in the garden.
          </h1>
          <p className="font-sans text-sm text-stone-500 text-center mb-4 max-w-sm">
            Something went wrong. Refreshing usually fixes it.
          </p>
          {error && (
            <div className="w-full max-w-lg mb-6 rounded-xl bg-stone-800 text-left overflow-hidden border border-stone-600">
              <p className="font-sans text-xs font-medium text-amber-300 px-4 py-2 bg-stone-900/80">
                Error (for debugging):
              </p>
              <pre className="font-mono text-xs text-stone-300 p-4 overflow-auto max-h-40 whitespace-pre-wrap break-words">
                {error.message ?? String(error)}
              </pre>
              {errorInfo?.componentStack && (
                <details className="border-t border-stone-600">
                  <summary className="font-sans text-xs text-stone-400 px-4 py-2 cursor-pointer hover:bg-stone-800">
                    Component stack
                  </summary>
                  <pre className="font-mono text-xs text-stone-500 p-4 overflow-auto max-h-32 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-sans text-sm font-medium text-white bg-moss-600 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
          >
            Refresh App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
