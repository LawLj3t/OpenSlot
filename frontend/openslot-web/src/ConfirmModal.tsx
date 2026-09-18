import React from 'react'

export interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string | React.ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'primary'
  loading?: boolean
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null

  const iconClass =
    variant === 'danger'
      ? 'bi-exclamation-triangle-fill text-danger'
      : variant === 'warning'
      ? 'bi-exclamation-circle-fill text-warning'
      : 'bi-info-circle-fill text-primary'

  const btnClass =
    variant === 'danger'
      ? 'btn-danger'
      : variant === 'warning'
      ? 'btn-warning text-dark'
      : 'btn-primary'

  return (
    <div className="confirm-modal-backdrop" onClick={onCancel}>
      <div className="confirm-modal-body" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-title">
            <i className={`bi ${iconClass} fs-4 me-2`} />
            <h5 className="m-0 fw-bold">{title}</h5>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onCancel}
            disabled={loading}
          />
        </div>

        <div className="confirm-modal-content my-3">
          {typeof message === 'string' ? <p className="m-0 text-secondary">{message}</p> : message}
        </div>

        <div className="confirm-modal-footer d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary rounded-pill px-4"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`btn ${btnClass} rounded-pill px-4`}
            onClick={() => void onConfirm()}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true" />
                Đang xử lý...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
