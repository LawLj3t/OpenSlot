import { useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { api } from './api'
import type { Session, SupportTicket } from './types'

const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export function SupportRequestPage({ session }: { session: Session | null }) {
  const [userRole, setUserRole] = useState<'Buyer' | 'Seller'>('Buyer')
  const [category, setCategory] = useState('Đặt chỗ & Giữ chỗ (Booking & Hold)')
  const [senderEmail, setSenderEmail] = useState(session?.user.email ?? '')
  const [content, setContent] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [attachmentData, setAttachmentData] = useState<string | null>(null)
  const [attachmentError, setAttachmentError] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null)

  const categories = [
    'Đặt chỗ & Giữ chỗ (Booking & Hold)',
    'Thanh toán & Chuyển khoản VietinBank',
    'Khiếu nại về đối tác / Khách hàng',
    'Chính sách Strike & Khóa tài khoản',
    'Duyệt hồ sơ đối tác / Dịch vụ',
    'Vấn đề tài khoản & Đăng nhập',
    'Khác / Góp ý hệ thống'
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError('')
    const file = e.target.files?.[0]
    if (!file) {
      setAttachmentFile(null)
      setAttachmentData(null)
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('Dung lượng tệp đính kèm không được vượt quá 5MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    const validExtensions = /\.(jpe?g|png|pdf)$/i
    if (!validTypes.includes(file.type) && !validExtensions.test(file.name)) {
      setAttachmentError('Định dạng tệp không hợp lệ. Chỉ chấp nhận tệp JPG, JPEG, PNG hoặc PDF.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAttachmentData(reader.result as string)
      setAttachmentFile(file)
    }
    reader.onerror = () => {
      setAttachmentError('Không thể đọc tệp đã chọn. Vui lòng thử lại.')
      setAttachmentFile(null)
      setAttachmentData(null)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveAttachment = () => {
    setAttachmentFile(null)
    setAttachmentData(null)
    setAttachmentError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail.trim())) {
      setError('Vui lòng nhập địa chỉ email hợp lệ để nhận phản hồi từ CSKH.')
      return
    }
    if (content.trim().length < 10) {
      setError('Vui lòng mô tả chi tiết vấn đề cần hỗ trợ (tối thiểu 10 ký tự).')
      return
    }

    setLoading(true)
    try {
      const ticket = await api.createSupportTicket({
        userRole,
        category,
        senderEmail: senderEmail.trim(),
        content: content.trim(),
        attachmentFileName: attachmentFile?.name ?? null,
        attachmentData: attachmentData ?? null
      }, session?.accessToken)
      setSubmittedTicket(ticket)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể gửi yêu cầu hỗ trợ. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  if (submittedTicket) {
    return (
      <div className="ticket-form-page">
        <div className="ticket-form-card text-center py-5">
          <div className="mb-3" style={{ fontSize: 56, color: '#10b981' }}>
            <i className="bi bi-check-circle-fill" />
          </div>
          <h2 className="mb-2">Gửi yêu cầu hỗ trợ thành công!</h2>
          <p className="text-muted small mb-4">
            Mã yêu cầu: <strong className="text-danger">#TK-{submittedTicket.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <div className="alert alert-light border text-start mb-4" style={{ fontSize: 13 }}>
            <div><b>Vai trò:</b> {submittedTicket.userRole === 'Buyer' ? 'Người mua (Khách hàng)' : 'Người bán (Đối tác)'}</div>
            <div><b>Danh mục:</b> {submittedTicket.category}</div>
            <div><b>Email nhận phản hồi:</b> {submittedTicket.senderEmail}</div>
            <div><b>Thời gian gửi:</b> {formatTime(submittedTicket.createdAtUtc)}</div>
            {submittedTicket.attachmentFileName && (
              <div><b>Tệp đính kèm:</b> <span className="badge bg-light text-dark border ms-1"><i className="bi bi-paperclip me-1" />{submittedTicket.attachmentFileName}</span></div>
            )}
          </div>
          <p className="small text-muted mb-4">
            Đội ngũ Chăm sóc khách hàng (CSKH) OpenSlot đã tiếp nhận thông tin và sẽ gửi phản hồi qua email của bạn trong thời gian sớm nhất.
          </p>
          <div className="d-flex justify-content-center gap-3">
            <NavLink to="/help" className="btn btn-outline-secondary rounded-pill px-4">
              Về Trung tâm hỗ trợ
            </NavLink>
            <NavLink to="/" className="btn btn-primary rounded-pill px-4">
              Trang chủ OpenSlot
            </NavLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ticket-form-page">
      <div className="ticket-form-card">
        <div className="ticket-form-header">
          <NavLink to="/help" className="back-link d-inline-flex mb-3">
            <i className="bi bi-arrow-left" /> Quay lại Trung tâm hỗ trợ
          </NavLink>
          <h2>Đội chăm sóc khách hàng OpenSlot</h2>
          <p>Vui lòng điền chi tiết bên dưới. Nhân viên CSKH sẽ phản hồi qua email của bạn.</p>
        </div>

        {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>
            <span>Bạn là:<em>*</em></span>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value as 'Buyer' | 'Seller')}>
              <option value="Buyer">Người mua (Khách hàng)</option>
              <option value="Seller">Người bán (Đối tác / Cửa hàng)</option>
            </select>
          </label>

          <label>
            <span>Vấn đề cần hỗ trợ:<em>*</em></span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Email nhận phản hồi:<em>*</em></span>
            <input
              type="email"
              required
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="ten@gmail.com"
            />
          </label>

          <label>
            <span>Mô tả chi tiết nội dung sự cố:<em>*</em></span>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Vui lòng cung cấp chi tiết: mã đơn hàng, ngày giờ xảy ra sự cố, tên đối tác hoặc mô tả vấn đề..."
            />
          </label>

          <div className="border rounded-3 p-3 bg-light mb-3">
            <label className="d-block fw-bold small text-dark mb-1" htmlFor="support-file-input">
              <i className="bi bi-paperclip me-1 text-danger" />
              Tệp đính kèm chứng minh (tùy chọn):
            </label>
            <p className="ticket-form-disclaimer mb-2">
              Đính kèm biên lai chuyển khoản, ảnh chụp màn hình lỗi hoặc chứng từ liên quan (tối đa 5MB, JPG/PNG/PDF).
            </p>

            <input
              id="support-file-input"
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={handleFileChange}
              className="form-control form-control-sm mb-2"
            />

            {attachmentError && (
              <div className="text-danger small mt-1 mb-2">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {attachmentError}
              </div>
            )}

            {attachmentFile && (
              <div className="d-flex align-items-center justify-content-between p-2 bg-white border rounded-2 mt-2">
                <div className="d-flex align-items-center gap-2 text-truncate me-2">
                  {attachmentData?.startsWith('data:image/') ? (
                    <img
                      src={attachmentData}
                      alt="Preview"
                      style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                    />
                  ) : (
                    <i className="bi bi-file-earmark-pdf fs-3 text-danger" />
                  )}
                  <div className="text-truncate">
                    <div className="small fw-bold text-dark text-truncate">{attachmentFile.name}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {(attachmentFile.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-0 px-2"
                  onClick={handleRemoveAttachment}
                  title="Xóa tệp đính kèm"
                >
                  <i className="bi bi-trash" />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-100 rounded-pill py-3 fw-bold"
          >
            {loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ'}
          </button>
        </form>
      </div>
    </div>
  )
}
