import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Error capturado por ErrorBoundary:', error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
                    <div className="max-w-lg w-full bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                        {/* Header */}
                        <div className="bg-red-500 p-8 text-center">
                            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle className="w-8 h-8 text-white" />
                            </div>
                            <h1 className="text-xl font-black text-white uppercase tracking-wider">
                                Error Inesperado
                            </h1>
                            <p className="text-red-100 text-sm mt-2">
                                Algo salió mal en la aplicación
                            </p>
                        </div>

                        {/* Body */}
                        <div className="p-8 space-y-6">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4">
                                <p className="text-sm font-bold text-red-800 dark:text-red-200 mb-2">
                                    Detalles del error:
                                </p>
                                <code className="text-xs text-red-600 dark:text-red-300 break-all block">
                                    {this.state.error?.message || 'Error desconocido'}
                                </code>
                            </div>

                            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                                Por favor, intenta recargar la página. Si el problema persiste,
                                contacta al administrador del sistema.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={this.handleReload}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all active:scale-95"
                                >
                                    <RefreshCw className="w-5 h-5" />
                                    Recargar
                                </button>
                                <button
                                    onClick={this.handleGoHome}
                                    className="flex items-center justify-center gap-2 px-6 py-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all active:scale-95"
                                >
                                    <Home className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                            <p className="text-xs text-slate-400 text-center uppercase tracking-widest">
                                GDP Cloud • Error Recovery Module
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
