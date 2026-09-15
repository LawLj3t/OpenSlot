import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            maxWidth: '500px',
            padding: '2rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <span style={{
              display: 'inline-block',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fee',
              color: '#c33',
              fontSize: '32px',
              lineHeight: '64px',
              marginBottom: '1rem'
            }}>⚠</span>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#222' }}>
              Đã có lỗi xảy ra
            </h1>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              OpenSlot gặp sự cố không mong muốn. Hãy tải lại trang để tiếp tục.
            </p>
            {this.state.error && (
              <details style={{
                textAlign: 'left',
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px',
                fontSize: '0.875rem',
                marginBottom: '1rem',
                color: '#555'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Chi tiết lỗi
                </summary>
                <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </code>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 2rem',
                backgroundColor: '#2f6fed',
                color: 'white',
                border: 'none',
                borderRadius: '24px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
