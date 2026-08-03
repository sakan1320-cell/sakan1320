import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { logSystemError } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    logSystemError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[80vh] w-full flex-col items-center justify-center p-4 bg-background">
          <div className="flex w-full max-w-md flex-col items-center justify-center gap-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-500">
            <div className="rounded-full bg-destructive/10 p-4">
              <AlertCircle className="h-12 w-12 text-destructive animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-destructive">حدث خطأ غير متوقع</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {this.state.error?.message || "عذراً، واجه النظام مشكلة في عرض هذه الصفحة. يرجى المحاولة مرة أخرى."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full mt-4">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-md"
              >
                <RefreshCw className="h-4 w-4" />
                تحديث الصفحة
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-bold text-foreground transition-all hover:bg-muted hover:scale-105 active:scale-95 shadow-sm"
              >
                <Home className="h-4 w-4" />
                الرئيسية
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
