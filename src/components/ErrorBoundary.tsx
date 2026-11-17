import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isFirestorePermissionError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
    isFirestorePermissionError: false,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let displayMessage = error.message || 'An unexpected error occurred.';
    let isFirestorePermissionError = false;

    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error && parsed.operationType) {
        isFirestorePermissionError = parsed.error.toLowerCase().includes('permission') ||
          parsed.error.toLowerCase().includes('insufficient');
        displayMessage = isFirestorePermissionError
          ? `Cloud permission error during ${parsed.operationType} on "${parsed.path || 'database'}". Please sign in with an authorized account and try again.`
          : `Database ${parsed.operationType} failed on "${parsed.path || 'record'}": ${parsed.error}`;
      }
    } catch {
      // keep plain message
    }

    return {
      hasError: true,
      message: displayMessage,
      isFirestorePermissionError,
    };
  }

  public componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught error:', error);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#03150b] text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#051c10] border border-red-500/40 rounded-2xl p-5 space-y-4 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">
                  {this.state.isFirestorePermissionError ? 'Cloud Sync Authorization Needed' : 'Something Went Wrong'}
                </h2>
                <p className="text-xs text-zinc-400">CAS9i Virtual Sports &amp; Casino</p>
              </div>
            </div>

            <div className="bg-[#03150b] border border-zinc-800 rounded-xl p-3 text-xs text-red-200 font-medium break-words">
              {this.state.message}
            </div>

            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.reload();
                }
              }}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-[#00ad3a] to-[#00e700] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
