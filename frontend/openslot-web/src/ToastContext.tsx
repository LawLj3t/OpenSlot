import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newToast: ToastItem = { id, type, message, title, duration }
      setToasts((prev) => [...prev.slice(-4), newToast])

      if (duration > 0) {
        window.setTimeout(() => {
          removeToast(id)
        }, duration)
      }
    },
    [removeToast]
  )

  const success = useCallback((message: string, title?: string) => showToast('success', message, title ?? 'Thành công'), [showToast])
  const error = useCallback((message: string, title?: string) => showToast('error', message, title ?? 'Đã xảy ra lỗi'), [showToast])
  const warning = useCallback((message: string, title?: string) => showToast('warning', message, title ?? 'Lưu ý'), [showToast])
  const info = useCallback((message: string, title?: string) => showToast('info', message, title ?? 'Thông báo'), [showToast])

  const contextValue = useMemo(
    () => ({ showToast, success, error, warning, info, removeToast }),
    [showToast, success, error, warning, info, removeToast]
  )

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bi-check-circle-fill'
      case 'error': return 'bi-exclamation-triangle-fill'
      case 'warning': return 'bi-exclamation-circle-fill'
      case 'info': return 'bi-info-circle-fill'
    }
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="os-toast-container" role="region" aria-label="Thông báo hệ thống">
        {toasts.map((toast) => (
          <div key={toast.id} className={`os-toast ${toast.type}`} role="alert">
            <i className={`bi ${getIcon(toast.type)} os-toast-icon`} />
            <div className="os-toast-body">
              {toast.title && <div className="os-toast-title">{toast.title}</div>}
              <p className="os-toast-message">{toast.message}</p>
            </div>
            <button
              type="button"
              className="os-toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Đóng"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
