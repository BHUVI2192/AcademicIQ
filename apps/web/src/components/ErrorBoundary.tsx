import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="card max-w-lg text-center">
            <div className="mb-4 flex justify-center">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <h2 className="mb-2 text-xl font-medium text-slate-900 dark:text-slate-100">
              Something went wrong
            </h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
            <button onClick={this.reset} className="btn btn-primary inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
