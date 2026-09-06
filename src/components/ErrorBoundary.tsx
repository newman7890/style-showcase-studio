import React, { Component, ErrorInfo, ReactNode } from "react";
import { RotateCcw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
          <div className="max-w-md w-full bg-card border border-border rounded-3xl p-6 sm:p-8 text-center shadow-lg space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                We encountered an unexpected issue while loading this page:
              </p>
              {this.state.error && (
                <div className="text-left bg-destructive/10 text-destructive text-xs p-3 rounded-lg overflow-auto max-h-40 font-mono">
                  <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                  {this.state.error.stack && (
                    <pre className="mt-1 text-[10px] opacity-80 whitespace-pre-wrap">{this.state.error.stack}</pre>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-md active:scale-98 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
