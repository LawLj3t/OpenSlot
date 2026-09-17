import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { Session, SupportTicket } from './types'

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export function CskhPage({ session }: { session: Session }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | undefined>(undefined)
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [resolutionStatus, setResolutionStatus] = useState<number>(2)
  const [resolving, setResolving] = useState(false)
  const [message, setMessage] = useState('')

  const loadTickets = useCallback(() => {
    setLoading(true)
    setError('')
    api.supportTickets(session.accessToken, statusFilter, roleFilter || undefined)
      .then(setTickets)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [roleFilter, session.accessToken, statusFilter])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- ticket list load belongs to request lifecycle
    loadTickets()
  }, [loadTickets])

  const openResolution = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setResolutionNote(ticket.resolutionNote ?? '')
    setResolutionStatus(ticket.status === 0 ? 1 : ticket.status)
    setMessage('')
  }

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicket) return
    setResolving(true)
    setError('')
    try {
      const updated = await api.resolveSupportTicket(selectedTicket.id, {
        resolutionNote,
        status: resolutionStatus
      }, session.accessToken)
      setMessage(`Đã cập nhật ticket #TK-${updated.id.slice(0, 8).toUpperCase()}`)
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      setSelectedTicket(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu xử lý.')
    } finally {
      setResolving(false)
    }
  }

  const totalCount = tickets.length
  const pendingCount = tickets.filter((t) => t.status === 0).length
  const inProgressCount = tickets.filter((t) => t.status === 1).length
  const resolvedCount = tickets.filter((t) => t.status === 2).length

  return (
    <div className="container dashboard">
      <div className="provider-heading">
        <div>
          <p className="eyebrow">Bộ phận CSKH & Khiếu nại OpenSlot</p>
          <h1>Quản lý yêu cầu hỗ trợ khách hàng</h1>
        </div>
        <button type="button" onClick={loadTickets} className="btn btn-outline-primary rounded-pill">
          <i className="bi bi-arrow-clockwise me-1" /> Làm mới
        </button>
      </div>

      <div className="cskh-stats-grid">
        <div className="cskh-stat-card">
          <div className="cskh-stat-icon total"><i className="bi bi-inboxes" /></div>
          <div>
            <b>{totalCount}</b>
            <small>Tổng yêu cầu</small>
          </div>
        </div>
        <div className="cskh-stat-card">
          <div className="cskh-stat-icon pending"><i className="bi bi-hourglass-split" /></div>
          <div>
            <b>{pendingCount}</b>
            <small>Chờ xử lý</small>
          </div>
        </div>
        <div className="cskh-stat-card">
          <div className="cskh-stat-icon processing"><i className="bi bi-gear" /></div>
          <div>
            <b>{inProgressCount}</b>
            <small>Đang xử lý</small>
          </div>
        </div>
        <div className="cskh-stat-card">
          <div className="cskh-stat-icon resolved"><i className="bi bi-check2-circle" /></div>
          <div>
            <b>{resolvedCount}</b>
            <small>Đã giải quyết</small>
          </div>
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4 bg-white p-3 rounded-3 border">
        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted fw-bold">Trạng thái:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={statusFilter === undefined ? '' : statusFilter}
            onChange={(e) => setStatusFilter(e.target.value === '' ? undefined : Number(e.target.value))}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="0">0 - Chờ xử lý</option>
            <option value="1">1 - Đang xử lý</option>
            <option value="2">2 - Đã giải quyết</option>
          </select>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="small text-muted fw-bold">Vai trò:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Tất cả người gửi</option>
            <option value="Buyer">Người mua (Buyer)</option>
            <option value="Seller">Người bán (Seller)</option>
          </select>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {message && <div className="alert alert-success">{message}</div>}

      {loading ? (
        <div className="empty-state"><div className="spinner-border text-primary" /></div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-ticket-detailed" />
          <h3>Không có yêu cầu hỗ trợ nào</h3>
          <p className="small text-muted">Hiện tại không có ticket nào phù hợp với bộ lọc đã chọn.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="cskh-ticket-card">
              <div className="cskh-ticket-top">
                <div className="d-flex align-items-center gap-2">
                  <span className="cskh-ticket-id">#TK-{ticket.id.slice(0, 8).toUpperCase()}</span>
                  <span className={`cskh-ticket-role ${ticket.userRole === 'Buyer' ? 'buyer' : 'seller'}`}>
                    {ticket.userRole === 'Buyer' ? 'Khách hàng' : 'Đối tác'}
                  </span>
                  <span className="badge bg-secondary">{ticket.category}</span>
                </div>
                <div>
                  <span className={`cskh-status-badge status-${ticket.status}`}>
                    {ticket.status === 0 ? 'Chờ xử lý' : ticket.status === 1 ? 'Đang xử lý' : 'Đã giải quyết'}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-1 fw-bold text-dark">{ticket.content}</p>
                <div className="small text-muted">
                  <span>Người gửi: <b>{ticket.senderEmail}</b></span> · <span>Thời gian: {formatTime(ticket.createdAtUtc)}</span>
                  {ticket.attachmentFileName && (
                    <span className="ms-2 badge bg-light text-dark border">
                      <i className="bi bi-paperclip me-1" />
                      {ticket.attachmentFileName}
                    </span>
                  )}
                </div>
              </div>

              {ticket.resolutionNote && (
                <div className="p-2 bg-light rounded-2 small text-dark border-start border-3 border-success">
                  <b>Phản hồi CSKH ({ticket.resolvedByName || 'CSKH'}):</b> {ticket.resolutionNote}
                  {ticket.resolvedAtUtc && <span className="ms-2 text-muted">({formatTime(ticket.resolvedAtUtc)})</span>}
                </div>
              )}

              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary rounded-pill px-3"
                  onClick={() => openResolution(ticket)}
                >
                  <i className="bi bi-pencil-square me-1" />
                  Xử lý ticket
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTicket && (
        <div
          role="dialog"
          aria-modal="true"
          className="cskh-modal-backdrop"
          onClick={() => setSelectedTicket(null)}
        >
          <div className="cskh-modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h3 className="h5 mb-0 fw-bold">
                Xử lý yêu cầu #TK-{selectedTicket.id.slice(0, 8).toUpperCase()}
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => setSelectedTicket(null)}
                aria-label="Đóng"
              />
            </div>

            <div className="p-3 bg-light rounded-3 mb-3 small">
              <div className="mb-1"><b>Người gửi:</b> {selectedTicket.senderEmail} ({selectedTicket.userRole})</div>
              <div className="mb-1"><b>Chủ đề:</b> {selectedTicket.category}</div>
              <div className="mb-1"><b>Thời gian:</b> {formatTime(selectedTicket.createdAtUtc)}</div>
              <hr className="my-2" />
              <div><b>Nội dung:</b> {selectedTicket.content}</div>
              {selectedTicket.attachmentFileName && (
                <div className="mt-2 pt-2 border-top">
                  <b><i className="bi bi-paperclip me-1 text-danger" />Tệp đính kèm chứng minh:</b>
                  <div className="d-flex align-items-center gap-2 mt-1">
                    <span className="badge bg-white text-dark border">
                      {selectedTicket.attachmentFileName}
                    </span>
                    {selectedTicket.attachmentData && (
                      <a
                        href={selectedTicket.attachmentData}
                        download={selectedTicket.attachmentFileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                        style={{ fontSize: 12 }}
                      >
                        <i className="bi bi-download me-1" />
                        Tải xuống / Xem
                      </a>
                    )}
                  </div>
                  {selectedTicket.attachmentData && (selectedTicket.attachmentData.startsWith('data:image/') || /\.(jpe?g|png|webp|gif)$/i.test(selectedTicket.attachmentFileName)) && (
                    <div className="mt-2 text-center">
                      <img
                        src={selectedTicket.attachmentData}
                        alt={selectedTicket.attachmentFileName}
                        style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid #cbd5e1' }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={handleResolve}>
              <div className="mb-3">
                <label className="form-label fw-bold small">Cập nhật trạng thái:</label>
                <select
                  className="form-select form-select-sm"
                  value={resolutionStatus}
                  onChange={(e) => setResolutionStatus(Number(e.target.value))}
                >
                  <option value={1}>1 - Đang xử lý (In Progress)</option>
                  <option value={2}>2 - Đã giải quyết (Resolved)</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small">Ghi chú xử lý / Nội dung phản hồi:</label>
                <textarea
                  className="form-control"
                  rows={4}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Ghi chú hướng giải quyết, hoàn tiền hoặc phản hồi cho người dùng..."
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                  onClick={() => setSelectedTicket(null)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="btn btn-sm btn-primary rounded-pill px-4"
                >
                  {resolving ? 'Đang lưu...' : 'Lưu và hoàn tất'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
