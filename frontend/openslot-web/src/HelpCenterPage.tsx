import { useState } from 'react'
import { NavLink } from 'react-router-dom'

export function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null)

  const categories = [
    { id: 'booking', name: 'Đặt chỗ & Giữ chỗ', icon: 'bi-calendar2-check', desc: 'Quy định 10 phút, đặt lịch, xác nhận' },
    { id: 'payment', name: 'Thanh toán & Chuyển khoản', icon: 'bi-credit-card', desc: 'QR VietinBank, hóa đơn & xác thực' },
    { id: 'strike', name: 'Chính sách hủy & Strike', icon: 'bi-shield-exclamation', desc: 'Giới hạn vi phạm, mở khóa tài khoản' },
    { id: 'checkin', name: 'Check-in tại điểm hẹn', icon: 'bi-qr-code-scan', desc: 'Quét mã QR, nhập PIN 4 số bảo mật' },
    { id: 'customer', name: 'Dành cho Khách hàng', icon: 'bi-person-heart', desc: 'Lịch đã đặt, đổi mật khẩu, thông báo' },
    { id: 'provider', name: 'Dành cho Đối tác (Shop)', icon: 'bi-shop', desc: 'Đăng ký cửa hàng, duyệt hồ sơ, tạo slot' },
    { id: 'security', name: 'Tài khoản & Bảo mật', icon: 'bi-lock', desc: 'Xác minh Gmail, phân quyền, an toàn' },
    { id: 'policy', name: 'Quy chế & Khiếu nại', icon: 'bi-file-earmark-text', desc: 'Giải quyết tranh chấp, bồi thường' },
  ]

  const faqs = [
    {
      q: 'Quy định giữ chỗ 10 phút trên OpenSlot hoạt động như thế nào?',
      category: 'booking',
      a: 'Khi bạn nhấn "Tiếp tục thanh toán" trên trang chi tiết slot, hệ thống sẽ tạm khóa slot độc quyền cho bạn trong 10 phút (600 giây). Đồng hồ đếm ngược sẽ hiển thị trên màn hình thanh toán. Nếu quá thời gian này bạn chưa hoàn tất thanh toán, slot sẽ tự động nhả ra để người dùng khác có thể đặt.'
    },
    {
      q: 'Tôi hủy slot hoặc không đến có bị tính strike không?',
      category: 'strike',
      a: 'Để bảo vệ thời gian của đối tác và cơ hội của khách hàng khác, OpenSlot quy định hủy slot trước giờ bắt đầu ít nhất 15 phút sẽ không bị tính strike. Hủy sát giờ (dưới 15 phút) hoặc vắng mặt khi đối tác check-in sẽ bị ghi nhận 1 strike. Khi tài khoản tích lũy 3 strike, bạn sẽ tạm thời bị khóa quyền giữ chỗ.'
    },
    {
      q: 'Tôi chuyển khoản VietinBank thành công nhưng đơn chưa cập nhật?',
      category: 'payment',
      a: 'Trong hầu hết các trường hợp, hệ thống sẽ cập nhật trạng thái ngay sau khi bạn bấm "Tôi đã thanh toán". Nếu sau 3 phút chưa thấy mã QR check-in, vui lòng bấm "Gửi yêu cầu hỗ trợ" bên dưới kèm ảnh chụp biên lai giao dịch, CSKH sẽ hỗ trợ xác nhận thủ công trong 15 phút.'
    },
    {
      q: 'Làm thế nào để check-in khi đến cửa hàng / sân bãi?',
      category: 'checkin',
      a: 'Sau khi hoàn tất giữ chỗ, hệ thống cung cấp cho bạn 1 mã QR Check-in kèm mã PIN 4 chữ số bí mật trong mục "Lịch của tôi". Khi tới điểm hẹn, hãy xuất trình mã QR cho nhân viên đối tác quét hoặc đọc mã PIN để xác thực bắt đầu sử dụng dịch vụ.'
    },
    {
      q: 'Làm thế nào để đăng ký trở thành Đối tác (Provider) bán slot trống?',
      category: 'provider',
      a: 'Bất kỳ người dùng nào đã xác minh tài khoản đều có thể bấm vào "Đăng ký cửa hàng" trên thanh điều hướng. Điền tên thương hiệu, địa chỉ, ảnh giấy phép và dịch vụ. Đội ngũ Quản lý vận hành OpenSlot sẽ xem xét và phê duyệt hồ sơ trong vòng 24h làm việc.'
    },
    {
      q: 'Nếu đối tác hủy slot đột xuất hoặc dịch vụ không đúng mô tả thì sao?',
      category: 'policy',
      a: 'Nếu đối tác đơn phương hủy lịch hẹn hoặc không cung cấp đúng dịch vụ cam kết, hệ thống sẽ bảo vệ người mua 100%. Bạn có thể bấm "Báo cáo thông tin" trên slot hoặc gửi ngay yêu cầu hỗ trợ đến Đội CSKH để được can thiệp xử lý và bồi thường theo chính sách nền tảng.'
    }
  ]

  const hotKeywords = ['Hủy slot sát giờ', 'Quy định Strike', 'Mã PIN Check-in', 'Đăng ký đối tác', 'Thanh toán VietinBank']

  const filteredFaqs = faqs.filter((faq) => {
    const matchCategory = !selectedCategory || faq.category === selectedCategory
    const query = searchQuery.toLowerCase().trim()
    const matchQuery = !query || faq.q.toLowerCase().includes(query) || faq.a.toLowerCase().includes(query)
    return matchCategory && matchQuery
  })

  return (
    <div className="help-page">
      <section className="help-hero">
        <h1>Xin chào, OpenSlot có thể giúp gì cho bạn?</h1>
        <div className="help-search-wrap">
          <input
            type="text"
            className="help-search-input"
            placeholder="Nhập từ khóa hoặc câu hỏi cần giải đáp (ví dụ: hủy slot, strike, thanh toán)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="button" className="help-search-btn" title="Tìm kiếm">
            <i className="bi bi-search" />
          </button>
        </div>
        <div className="help-hot-tags">
          <span>Tìm kiếm phổ biến:</span>
          {hotKeywords.map((kw) => (
            <button key={kw} type="button" onClick={() => setSearchQuery(kw)}>
              {kw}
            </button>
          ))}
        </div>
      </section>

      <div className="help-container">
        <h2 className="help-section-title">Danh mục trợ giúp</h2>
        <div className="help-categories-grid">
          {categories.map((cat) => (
            <div
              key={cat.id}
              role="button"
              tabIndex={0}
              className={`help-category-card ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCategory(selectedCategory === cat.id ? null : cat.id) }}
            >
              <div className="help-category-icon">
                <i className={`bi ${cat.icon}`} />
              </div>
              <b>{cat.name}</b>
              <small>{cat.desc}</small>
            </div>
          ))}
        </div>

        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 className="help-section-title mb-0">
            {selectedCategory ? `Câu hỏi theo danh mục: ${categories.find((c) => c.id === selectedCategory)?.name}` : 'Câu hỏi thường gặp'}
          </h2>
          {selectedCategory && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary rounded-pill"
              onClick={() => setSelectedCategory(null)}
            >
              Xem tất cả câu hỏi
            </button>
          )}
        </div>

        <div className="help-faq-list">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, idx) => (
              <div key={idx} className="help-faq-item">
                <button
                  type="button"
                  className="help-faq-header"
                  onClick={() => setExpandedFaqIndex(expandedFaqIndex === idx ? null : idx)}
                >
                  <span><i className="bi bi-question-circle text-danger me-2" />{faq.q}</span>
                  <i className={`bi bi-chevron-${expandedFaqIndex === idx ? 'up' : 'down'}`} />
                </button>
                {expandedFaqIndex === idx && (
                  <div className="help-faq-body">
                    {faq.a}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="empty-state py-4 bg-white rounded-3 border">
              <i className="bi bi-search" />
              <p className="small mb-0">Không tìm thấy câu hỏi phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>

        <div className="help-contact-banner">
          <i className="bi bi-headset" style={{ fontSize: 44, color: 'var(--coral)' }} />
          <h3>Bạn vẫn chưa tìm thấy câu trả lời?</h3>
          <p>Đội ngũ Chăm sóc khách hàng (CSKH) OpenSlot luôn trực tuyến tiếp nhận yêu cầu, giải quyết khiếu nại và bảo vệ quyền lợi của bạn.</p>
          <NavLink to="/help/request" className="btn btn-primary rounded-pill px-4 py-2">
            <i className="bi bi-envelope-paper-fill me-2" />
            Gửi yêu cầu hỗ trợ
          </NavLink>
        </div>
      </div>
    </div>
  )
}
