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
            Something went wrong
          </h1>
          <p className="font-sans text-sm text-stone-500 text-center mb-6 max-w-sm">
            We hit a snag. Refreshing the app usually fixes it. Your data is saved locally.
          </p>
          {error && (
            <details className="w-full max-w-lg mb-6 rounded-xl bg-stone-200/80 dark:bg-stone-800/80 border border-stone-300 dark:border-stone-600 overflow-hidden">
              <summary className="font-sans text-xs font-medium text-stone-500 dark:text-stone-400 px-4 py-2 cursor-pointer hover:bg-stone-300/50 dark:hover:bg-stone-700/50">
                Technical details (for support)
              </summary>
              <div className="px-4 py-2 border-t border-stone-300 dark:border-stone-600">
                <pre className="font-mono text-xs text-stone-600 dark:text-stone-400 overflow-auto max-h-32 whitespace-pre-wrap break-words">
                  {error.message ?? String(error)}
                </pre>
                {errorInfo?.componentStack && (
                  <pre className="font-mono text-[10px] text-stone-500 dark:text-stone-500 mt-2 overflow-auto max-h-24 whitespace-pre-wrap border-t border-stone-300 dark:border-stone-600 pt-2 mt-2">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            </details>
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
