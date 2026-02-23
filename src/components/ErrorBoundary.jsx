import { Component } from 'react';

/**
 * Catches React render errors and shows a friendly fallback instead of a white screen.
 * Use once at the app root (e.g. in main.jsx) to protect the whole tree during beta.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
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
          <p className="font-sans text-sm text-stone-500 text-center mb-6 max-w-sm">
            Something went wrong. Refreshing usually fixes it.
          </p>
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
