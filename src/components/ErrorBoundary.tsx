import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[kyasuho] ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#dc2626', marginBottom: 12 }}>表示エラーが発生しました</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            {this.state.error?.message ?? '不明なエラー'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 20px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#f9fafb',
              cursor: 'pointer',
              marginRight: 8,
            }}
          >
            再試行
          </button>
          <button
            type="button"
            onClick={() => { window.location.hash = '#/admin/reservations'; window.location.reload(); }}
            style={{
              padding: '8px 20px',
              border: '1px solid #ccc',
              borderRadius: 6,
              background: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            トップに戻る
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
