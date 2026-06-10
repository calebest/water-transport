import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-rose-100">
            <h1 className="text-2xl font-black text-rose-600 mb-2">Something went wrong.</h1>
            <p className="text-slate-600 text-sm mb-4">
              The application encountered an unexpected error.
            </p>
            <div className="bg-slate-100 p-4 rounded-xl text-xs font-mono text-slate-800 overflow-auto mb-6">
              {this.state.error?.toString()}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
