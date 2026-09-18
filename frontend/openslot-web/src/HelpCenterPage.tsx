import { useState, useEffect, useCallback } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { api } from './api'
import type { Session, SupportTicket } from './types'

function normalizeVi(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function HelpCenterPage({ session }: { session?: Session | null }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null)

  const [viewingTicket, setViewingTicket] = useState<SupportTicket | null>(null)
  const [loadingTicket, setLoadingTicket] = useState(false)
  const [ticketError, setTicketError] = useState('')

  const [myTickets, setMyTickets] = useState<SupportTicket[]>([])
  const [showMyTickets, setShowMyTickets] = useState(false)
  const [loadingMyTickets, setLoadingMyTickets] = useState(false)

  const ticketIdParam = searchParams.get('ticketId')

  const fetchTicket = useCallback(async (id: string) => {
    if (!session?.accessToken) return
    setLoadingTicket(true)
    setTicketError('')
    try {
      const ticket = await api.mySupportTicket(id, session.accessToken)
      setViewingTicket(ticket)
    } catch {
      try {
        const ticket = await api.supportTicket(id, session.accessToken)
        setViewingTicket(ticket)
      } catch (err) {
        setTicketError(err instanceof Error ? err.message : 'Không thể tải chi tiết phản hồi CSKH.')
      }
    } finally {
      setLoadingTicket(false)
    }
  }, [session])

  useEffect(() => {
    if (ticketIdParam) {
      // oxlint-disable-next-line react/set-state-in-effect -- fetching ticket detail when query param is present
      void fetchTicket(ticketIdParam)
    }
  }, [ticketIdParam, fetchTicket])

  const loadMyTickets = useCallback(async () => {
    if (!session?.accessToken) return
    setLoadingMyTickets(true)
    try {
      const list = await api.mySupportTickets(session.accessToken)
      setMyTickets(list)
    } catch {
      // ignore
    } finally {
      setLoadingMyTickets(false)
    }
  }, [session])

  const closeTicketModal = () => {
    setViewingTicket(null)
    setTicketError('')
    if (searchParams.has('ticketId')) {
      searchParams.delete('ticketId')
      setSearchParams(searchParams, { replace: true })
    }
  }

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
    // Booking & Hold
    {
      q: 'Quy định giữ chỗ 10 phút trên OpenSlot hoạt động như thế nào?',
      category: 'booking',
      a: 'Khi bạn nhấn "Tiếp tục thanh toán" trên trang chi tiết slot, hệ thống sẽ tạm khóa slot độc quyền cho bạn trong 10 phút (600 giây). Đồng hồ đếm ngược sẽ hiển thị trên màn hình thanh toán. Nếu quá thời gian này bạn chưa hoàn tất thanh toán, slot sẽ tự động nhả ra để người dùng khác có thể đặt.'
    },
    {
      q: 'Tôi có thể đặt nhiều slot cùng một lúc được không?',
      category: 'booking',
      a: 'Mỗi tài khoản khách hàng tại một thời điểm chỉ được thực hiện một phiên giữ chỗ (Hold) đang đếm ngược để đảm bảo tính công bằng. Sau khi hoàn tất thanh toán hoặc hủy phiên giữ chỗ hiện tại, bạn có thể tiếp tục đặt các slot khác theo nhu cầu.'
    },
    {
      q: 'Làm thế nào để tìm kiếm các slot giờ chót giá tốt gần vị trí của tôi?',
      category: 'booking',
      a: 'Bạn có thể sử dụng bộ lọc "Vị trí gần tôi" và kích hoạt định vị GPS hoặc chọn Tỉnh / Thành phố trên trang Khám phá. Bạn cũng có thể chuyển sang chế độ "Bản đồ" để xem trực quan các sân bãi, salon, phòng họp xung quanh vị trí của mình.'
    },
    {
      q: 'Làm sao để biết slot đã được đặt thành công?',
      category: 'booking',
      a: 'Sau khi thanh toán thành công, màn hình sẽ hiển thị mã xác nhận đặt chỗ, mã PIN 4 số và mã QR Check-in. Đồng thời, thông tin đặt chỗ sẽ được lưu trữ ngay trong mục "Lịch của tôi" trên thanh menu để bạn tiện tra cứu.'
    },

    // Strike & Cancellation Policy
    {
      q: 'Hủy slot sát giờ và quy định tính Strike như thế nào?',
      category: 'strike',
      a: 'Để bảo vệ thời gian của đối tác và cơ hội của khách hàng khác, OpenSlot quy định hủy slot trước giờ bắt đầu ít nhất 15 phút sẽ không bị tính strike. Hủy sát giờ (dưới 15 phút) hoặc vắng mặt khi đối tác check-in sẽ bị ghi nhận 1 strike. Mỗi tài khoản có tối đa 3 lần strike.'
    },
    {
      q: 'Khi nào tài khoản bị khóa quyền giữ chỗ và cách mở khóa?',
      category: 'strike',
      a: 'Khi tài khoản tích lũy đủ 3 strike do vi phạm hủy slot sát giờ hoặc không đến check-in, tính năng giữ chỗ và săn deal sẽ tạm thời bị khóa. Bạn có thể gửi yêu cầu hỗ trợ qua mục "Hỗ Trợ" kèm lý do khách quan (ốm đau, sự cố giao thông,...) để CSKH xem xét gỡ strike.'
    },
    {
      q: 'Nếu đối tác tự ý hủy slot của tôi thì tôi có bị phạt strike không?',
      category: 'strike',
      a: 'Hoàn toàn không. Nếu đối tác đơn phương hủy lịch hẹn hoặc cơ sở đóng cửa bất khả kháng, bạn không bao giờ bị tính strike. Đồng thời, OpenSlot sẽ hoàn tiền 100% và ghi nhận vi phạm vào điểm uy tín của đối tác.'
    },

    // Payment & Bank Transfer
    {
      q: 'Thanh toán chuyển khoản VietinBank bằng mã QR như thế nào?',
      category: 'payment',
      a: 'Tại trang thanh toán, hệ thống sẽ sinh ra mã VietQR VietinBank kèm nội dung chuyển khoản tự động. Bạn chỉ cần mở ứng dụng ngân hàng bất kỳ (VietinBank iPay, Vietcombank, Techcombank, MoMo,...), quét mã QR và xác nhận chuyển đúng số tiền.'
    },
    {
      q: 'Tôi chuyển khoản VietinBank thành công nhưng đơn chưa cập nhật mã PIN?',
      category: 'payment',
      a: 'Thông thường hệ thống nhận diện giao dịch trong vài giây. Nếu sau 3 phút đơn chưa cập nhật, bạn hãy chụp ảnh biên lai chuyển tiền thành công, bấm "Gửi yêu cầu hỗ trợ" tại Trung tâm hỗ trợ và đính kèm biên lai. CSKH sẽ đối soát và kích hoạt lịch đặt cho bạn trong 15 phút.'
    },
    {
      q: 'Chính sách hoàn tiền khi hủy slot hợp lệ hoạt động ra sao?',
      category: 'payment',
      a: 'Nếu bạn hủy slot hợp lệ (trước giờ bắt đầu ít nhất 15 phút) hoặc đối tác hủy slot, số tiền sẽ được hoàn trả lại tài khoản ngân hàng hoặc ví liên kết của bạn trong vòng 1-3 ngày làm việc tùy thuộc vào ngân hàng thụ hưởng.'
    },

    // Check-in & Secret PIN
    {
      q: 'Mã PIN Check-in và mã QR Check-in lấy ở đâu, sử dụng thế nào?',
      category: 'checkin',
      a: 'Sau khi thanh toán thành công, mã QR và PIN bí mật (4 chữ số) sẽ xuất hiện tại trang xác nhận và luôn sẵn sàng trong mục "Lịch của tôi". Khi đến cơ sở của đối tác, bạn chỉ cần mở mã QR cho nhân viên quét hoặc đọc mã PIN 4 số để xác nhận bắt đầu sử dụng dịch vụ.'
    },
    {
      q: 'Quên mã PIN hoặc điện thoại mất mạng khi đến nơi thì làm sao?',
      category: 'checkin',
      a: 'Bạn có thể đọc số điện thoại hoặc địa chỉ email đã đăng ký trên OpenSlot cùng tên dịch vụ cho nhân viên đối tác. Nhân viên có thể tra cứu đơn đặt chỗ trên hệ thống Quản lý cửa hàng (Provider Portal) để hỗ trợ check-in thủ công.'
    },
    {
      q: 'Đối tác từ chối check-in hoặc thông báo hết chỗ thì phải xử lý thế nào?',
      category: 'checkin',
      a: 'Hãy yêu cầu nhân viên ghi nhận tình trạng và gửi ngay phản ánh khẩn cấp tới CSKH OpenSlot qua form hỗ trợ hoặc chat trực tiếp. OpenSlot sẽ kiểm tra dữ liệu đặt chỗ theo thời gian thực và áp dụng chính sách bồi thường bảo vệ quyền lợi người mua.'
    },

    // Provider & Shop Management
    {
      q: 'Làm thế nào để đăng ký trở thành Đối tác (Provider) bán slot trống?',
      category: 'provider',
      a: 'Bất kỳ người dùng nào đã có tài khoản OpenSlot đều có thể bấm vào "Đăng ký cửa hàng" trên menu chính. Điền thông tin thương hiệu, chọn loại hình dịch vụ (sân thể thao, làm đẹp, phòng họp,...), cung cấp địa chỉ và gửi hồ sơ đăng ký.'
    },
    {
      q: 'Quy trình duyệt hồ sơ đối tác mất bao lâu và cần những giấy tờ gì?',
      category: 'provider',
      a: 'Đội ngũ Quản lý vận hành OpenSlot sẽ thẩm định hồ sơ đối tác trong vòng 12 - 24 giờ làm việc. Bạn nên cung cấp hình ảnh mặt bằng thực tế, bảng hiệu kinh doanh hoặc giấy phép ĐKKD (nếu có doanh nghiệp) để việc xét duyệt diễn ra nhanh chóng.'
    },
    {
      q: 'Làm thế nào để tạo khung giờ và đăng slot giờ chót giảm giá?',
      category: 'provider',
      a: 'Sau khi được duyệt hồ sơ, bạn chuyển sang "Khu vực đối tác" > chọn "Quản lý slot" > "Thêm slot mới". Bạn có thể đặt khung giờ bắt đầu/kết thúc, giá gốc và giá ưu đãi giờ chót (Deal Price) để thu hút khách săn slot.'
    },
    {
      q: 'Đối tác nhận tiền doanh thu từ OpenSlot vào tài khoản ngân hàng khi nào?',
      category: 'provider',
      a: 'Doanh thu từ các slot đã check-in thành công sẽ được đối soát tự động hàng tuần (vào thứ 2 và thứ 5). Tiền sẽ được chuyển thẳng về số tài khoản ngân hàng mà đối tác đã đăng ký trong hồ sơ cửa hàng.'
    },

    // Customer & Personal Account
    {
      q: 'Làm thế nào để xem lại lịch đã đặt và lịch sử check-in?',
      category: 'customer',
      a: 'Bạn chỉ cần đăng nhập tài khoản khách hàng và nhấp vào mục "Lịch của tôi" trên thanh điều hướng đầu trang. Toàn bộ các slot sắp diễn ra, mã QR, mã PIN và lịch sử các đơn đã hoàn thành hoặc đã hủy đều được hiển thị đầy đủ.'
    },
    {
      q: 'Cách thức nhắn tin trao đổi trực tiếp với cửa hàng (OpenSlot Web Chat)?',
      category: 'customer',
      a: 'Tại trang chi tiết slot bất kỳ, bạn nhấp vào nút "Chat với cửa hàng" hoặc bấm vào biểu tượng Chat nổi góc dưới bên phải màn hình. Khung chat 2 cột OpenSlot Web Chat sẽ mở ra cho phép bạn hỏi thông tin dịch vụ trước khi quyết định đặt chỗ.'
    },

    // Account & Security
    {
      q: 'Tại sao tôi cần xác minh địa chỉ Gmail khi đăng ký tài khoản?',
      category: 'security',
      a: 'Xác minh Gmail giúp bảo vệ an toàn cho tài khoản, ngăn chặn tài khoản ảo trục lợi giữ chỗ và đảm bảo bạn luôn nhận được thông báo quan trọng về mã PIN check-in, hóa đơn giao dịch và phản hồi hỗ trợ từ CSKH.'
    },
    {
      q: 'Một tài khoản có thể vừa làm Khách hàng vừa làm Đối tác cửa hàng không?',
      category: 'security',
      a: 'Có. OpenSlot hỗ trợ chuyển đổi linh hoạt vai trò ngay trên cùng một tài khoản. Khi ở chế độ "Khách hàng", bạn có thể săn slot và chat với các shop khác. Khi ở chế độ "Đối tác", bạn quản lý cửa hàng và chat với khách hàng của riêng mình một cách hoàn toàn tách biệt.'
    },

    // Policy & Dispute Resolution
    {
      q: 'Nếu dịch vụ tại điểm hẹn không đúng với mô tả trên ứng dụng thì sao?',
      category: 'policy',
      a: 'OpenSlot cam kết chính sách bảo vệ người dùng 100%. Nếu cơ sở vật chất hoặc dịch vụ sai lệch nghiêm trọng so với mô tả, hãy chụp ảnh lại làm bằng chứng và gửi form khiếu nại tại Trung tâm hỗ trợ. CSKH sẽ điều tra và hoàn tiền nếu có sai phạm.'
    },
    {
      q: 'Quy trình giải quyết tranh chấp và thời gian phản hồi của CSKH?',
      category: 'policy',
      a: 'Mọi yêu cầu gửi qua Trung tâm hỗ trợ sẽ được cấp một mã vé #TK-xxxx. Đội CSKH OpenSlot cam kết phản hồi bước đầu trong vòng 2 giờ làm việc và xử lý dứt điểm các khiếu nại bồi hoàn trong vòng 24 giờ.'
    }
  ]

  const hotKeywords = [
    'Hủy slot sát giờ',
    'Quy định Strike',
    'Mã PIN Check-in',
    'Đăng ký đối tác',
    'Thanh toán VietinBank',
    'Giữ chỗ 10 phút',
    'Hoàn tiền',
    'Duyệt hồ sơ'
  ]

  const filteredFaqs = faqs.filter((faq) => {
    const matchCategory = !selectedCategory || faq.category === selectedCategory
    if (!matchCategory) return false

    const query = searchQuery.trim()
    if (!query) return true

    const normQuery = normalizeVi(query)
    const normQ = normalizeVi(faq.q)
    const normA = normalizeVi(faq.a)

    // Direct match (with accents removed)
    if (normQ.includes(normQuery) || normA.includes(normQuery)) {
      return true
    }

    // Token-based matching: all search words must exist in Question or Answer
    const tokens = normQuery.split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      const combined = `${normQ} ${normA}`
      return tokens.every((token) => combined.includes(token))
    }

    return false
  })

  const handleHotKeywordClick = (kw: string) => {
    setSearchQuery(kw)
    setSelectedCategory(null)
    setExpandedFaqIndex(null)
  }

  return (
    <div className="help-page">
      <section className="help-hero">
        <h1>Xin chào, OpenSlot có thể giúp gì cho bạn?</h1>
        <div className="help-search-wrap">
          <input
            type="text"
            className="help-search-input"
            placeholder="Nhập từ khóa hoặc câu hỏi cần giải đáp (ví dụ: hủy slot, strike, mã pin, vietinbank)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            type="button"
            className="help-search-btn"
            title="Tìm kiếm"
            onClick={() => setSelectedCategory(null)}
          >
            <i className="bi bi-search" />
          </button>
        </div>
        <div className="help-hot-tags">
          <span>Tìm kiếm phổ biến:</span>
          {hotKeywords.map((kw) => (
            <button
              key={kw}
              type="button"
              className={searchQuery === kw ? 'bg-danger text-white' : ''}
              onClick={() => handleHotKeywordClick(kw)}
            >
              {kw}
            </button>
          ))}
        </div>
      </section>

      <div className="help-container">
        {session && (
          <div className="d-flex justify-content-between align-items-center mb-4 p-3 bg-white rounded-3 border shadow-sm flex-wrap gap-2">
            <div>
              <h5 className="m-0 fw-bold"><i className="bi bi-person-check text-primary me-2" />Yêu cầu hỗ trợ của bạn</h5>
              <small className="text-muted">Theo dõi tiến độ xử lý và xem câu trả lời từ đội ngũ CSKH OpenSlot</small>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${showMyTickets ? 'btn-primary' : 'btn-outline-primary'} rounded-pill px-3`}
              onClick={() => {
                const next = !showMyTickets
                setShowMyTickets(next)
                if (next) void loadMyTickets()
              }}
            >
              <i className="bi bi-inbox me-1" />
              {showMyTickets ? 'Đóng danh sách' : 'Xem yêu cầu đã gửi'}
            </button>
          </div>
        )}

        {showMyTickets && (
          <div className="mb-4 p-3 bg-white rounded-3 border shadow-sm">
            <h6 className="fw-bold mb-3"><i className="bi bi-clock-history me-2 text-primary" />Lịch sử yêu cầu đã gửi</h6>
            {loadingMyTickets ? (
              <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary" /> Đang tải...</div>
            ) : myTickets.length ? (
              <div className="d-flex flex-column gap-2">
                {myTickets.map((t) => (
                  <div key={t.id} className="p-3 border rounded-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div>
                      <span className="badge bg-secondary-subtle text-dark me-2">{t.category}</span>
                      <span className={`badge ${t.status === 2 ? 'bg-success' : t.status === 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                        {t.status === 2 ? 'Đã phản hồi' : t.status === 0 ? 'Đang chờ xử lý' : 'Đã đóng'}
                      </span>
                      <p className="m-0 mt-1 text-secondary small text-truncate" style={{ maxWidth: 500 }}>{t.content}</p>
                      <small className="text-muted">{new Date(t.createdAtUtc).toLocaleString('vi-VN')}</small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary rounded-pill px-3"
                      onClick={() => setViewingTicket(t)}
                    >
                      {t.status === 2 ? 'Xem phản hồi CSKH' : 'Xem chi tiết'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted text-center m-0 py-2">Bạn chưa gửi yêu cầu hỗ trợ nào.</p>
            )}
          </div>
        )}

        <h2 className="help-section-title">Danh mục trợ giúp</h2>
        <div className="help-categories-grid">
          {categories.map((cat) => (
            <div
              key={cat.id}
              role="button"
              tabIndex={0}
              className={`help-category-card ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                setExpandedFaqIndex(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedCategory(selectedCategory === cat.id ? null : cat.id)
                  setExpandedFaqIndex(null)
                }
              }}
            >
              <div className="help-category-icon">
                <i className={`bi ${cat.icon}`} />
              </div>
              <b>{cat.name}</b>
              <small>{cat.desc}</small>
            </div>
          ))}
        </div>

        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <h2 className="help-section-title mb-0">
            {selectedCategory
              ? `Câu hỏi theo danh mục: ${categories.find((c) => c.id === selectedCategory)?.name}`
              : searchQuery
              ? `Kết quả tìm kiếm cho "${searchQuery}" (${filteredFaqs.length})`
              : 'Câu hỏi thường gặp'}
          </h2>
          <div className="d-flex gap-2 align-items-center">
            {searchQuery && (
              <button
                type="button"
                className="btn btn-sm btn-link text-decoration-none text-muted"
                onClick={() => setSearchQuery('')}
              >
                <i className="bi bi-x-circle me-1" />Xóa tìm kiếm
              </button>
            )}
            {selectedCategory && (
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill"
                onClick={() => setSelectedCategory(null)}
              >
                Xem tất cả danh mục
              </button>
            )}
          </div>
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
            <div className="empty-state py-5 bg-white rounded-3 border text-center">
              <i className="bi bi-search fs-1 text-secondary opacity-50 d-block mb-2" />
              <p className="fw-bold mb-1">Không tìm thấy câu hỏi phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;</p>
              <p className="small text-muted mb-3">Bạn hãy thử từ khóa ngắn gọn hơn hoặc chọn câu hỏi theo các danh mục phía trên.</p>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-pill px-3"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory(null)
                }}
              >
                Xem tất cả câu hỏi
              </button>
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

      {loadingTicket && (
        <div className="cskh-modal-backdrop">
          <div className="cskh-modal-body text-center py-5">
            <div className="spinner-border text-primary mb-2" />
            <p className="m-0 text-secondary">Đang tải phản hồi từ CSKH...</p>
          </div>
        </div>
      )}

      {ticketError && (
        <div className="cskh-modal-backdrop" onClick={closeTicketModal}>
          <div className="cskh-modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="m-0 text-danger fw-bold"><i className="bi bi-exclamation-triangle me-2" />Không thể xem yêu cầu</h5>
              <button type="button" className="btn-close" onClick={closeTicketModal} />
            </div>
            <p className="text-secondary mb-4">{ticketError}</p>
            <div className="text-end">
              <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={closeTicketModal}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingTicket && (
        <div className="cskh-modal-backdrop" onClick={closeTicketModal}>
          <div className="cskh-modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <div>
                <span className="badge bg-primary-subtle text-primary me-2">{viewingTicket.category}</span>
                <span className={`badge ${viewingTicket.status === 2 ? 'bg-success' : viewingTicket.status === 0 ? 'bg-warning text-dark' : 'bg-secondary'}`}>
                  {viewingTicket.status === 2 ? 'Đã phản hồi' : viewingTicket.status === 0 ? 'Đang chờ xử lý' : 'Đã đóng'}
                </span>
              </div>
              <button type="button" className="btn-close" onClick={closeTicketModal} aria-label="Close" />
            </div>

            <div className="mb-3">
              <label className="text-muted small fw-bold">Nội dung yêu cầu bạn đã gửi:</label>
              <div className="p-3 bg-light rounded-3 text-secondary" style={{ whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto' }}>
                {viewingTicket.content}
              </div>
              <small className="text-muted">Gửi lúc {new Date(viewingTicket.createdAtUtc).toLocaleString('vi-VN')}</small>
            </div>

            {viewingTicket.status === 2 && viewingTicket.resolutionNote ? (
              <div className="p-3 rounded-3" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                <div className="d-flex align-items-center mb-2">
                  <i className="bi bi-patch-check-fill text-success fs-4 me-2" />
                  <div>
                    <b className="text-success d-block">Phản hồi từ CSKH OpenSlot</b>
                    <small className="text-muted">Xử lý bởi {viewingTicket.resolvedByName || 'CSKH OpenSlot'} {viewingTicket.resolvedAtUtc ? `vào lúc ${new Date(viewingTicket.resolvedAtUtc).toLocaleString('vi-VN')}` : ''}</small>
                  </div>
                </div>
                <div className="text-dark p-2" style={{ whiteSpace: 'pre-wrap', fontSize: '15px', lineHeight: 1.6 }}>
                  {viewingTicket.resolutionNote}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-light rounded-3 text-center text-muted">
                <i className="bi bi-hourglass-split fs-4 d-block mb-1 text-warning" />
                Yêu cầu của bạn đang được chuyên viên CSKH tiếp nhận và xử lý. Bạn sẽ nhận được thông báo ngay khi có phản hồi.
              </div>
            )}

            <div className="mt-3 text-end">
              <button type="button" className="btn btn-primary rounded-pill px-4" onClick={closeTicketModal}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
