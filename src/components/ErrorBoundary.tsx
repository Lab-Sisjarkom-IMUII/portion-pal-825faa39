/**
 * React Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import { logError } from "@/lib/errorLogger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to our error tracking service
    logError(error, {
      source: 'ErrorBoundary',
      severity: 'high',
      additionalContext: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
      },
    });

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Terjadi Kesalahan</h2>
            </div>

            <p className="text-muted-foreground">
              Maaf, terjadi kesalahan yang tidak terduga. Kami telah mencatat error ini dan akan memperbaikinya segera.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 p-3 bg-muted rounded-lg text-xs font-mono overflow-auto max-h-48">
                <summary className="cursor-pointer font-semibold mb-2">
                  Error Details (Dev Only)
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Error:</strong> {this.state.error.name}
                  </div>
                  <div>
                    <strong>Message:</strong> {this.state.error.message}
                  </div>
                  {this.state.error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="flex-1 gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Lagi
              </Button>
              <Button
                onClick={this.handleGoHome}
                className="flex-1 gap-2"
              >
                <Home className="w-4 h-4" />
                Kembali ke Home
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

