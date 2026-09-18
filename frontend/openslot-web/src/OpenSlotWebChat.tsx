import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { ConfirmModal } from './ConfirmModal'
import { useChatRealtime } from './realtime'
import type { ChatMessage, Conversation, ConversationDetail, PortalRole, Session } from './types'

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export type PinnedSlotSnippet = {
  id?: string
  serviceName: string
  venueName: string
  dealPriceVnd: number
}

export function OpenSlotWebChat({ session, activeRole }: { session: Session | null; activeRole?: PortalRole }) {
  const currentRole: PortalRole = activeRole ?? (session?.activeRole as PortalRole | undefined) ?? 'Customer'

  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [activeDetail, setActiveDetail] = useState<ConversationDetail | null>(null)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [pinnedSlot, setPinnedSlot] = useState<PinnedSlotSnippet | null>(null)
  const [threadMenuId, setThreadMenuId] = useState<string | null>(null)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const isEligible = Boolean(session && (session.user.roles.includes('Customer') || session.user.roles.includes('Provider')))

  const loadConversations = useCallback(() => {
    if (!session) return
    api.chatConversations(session.accessToken, currentRole)
      .then(setConversations)
      .catch(() => setConversations([]))
  }, [currentRole, session])

  // When switching between Customer and Provider, isolate conversations and close open detail
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- reset selected conversation when role changes
    setActiveConversationId(null)
    // oxlint-disable-next-line react/set-state-in-effect -- reset selected conversation when role changes
    setActiveDetail(null)
    if (session && isEligible) {
      loadConversations()
    }
  }, [currentRole, isEligible, loadConversations, session])

  const selectConversation = useCallback(async (id: string) => {
    if (!session) return
    setThreadMenuId(null)
    setHeaderMenuOpen(false)
    setActiveConversationId(id)
    setLoading(true)
    try {
      const detail = await api.chatConversation(id, session.accessToken)
      setActiveDetail(detail)
      void api.markConversationRead(id, session.accessToken).catch(() => {})
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, unreadCount: 0 } : c))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [session])

  const handleDeleteConversation = useCallback((id: string, name: string) => {
    if (!session) return
    setThreadMenuId(null)
    setHeaderMenuOpen(false)
    setDeleteTarget({ id, name })
  }, [session])

  const confirmDeleteConversation = async () => {
    if (!session || !deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.deleteConversation(deleteTarget.id, session.accessToken)
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      if (activeConversationId === deleteTarget.id) {
        setActiveConversationId(null)
        setActiveDetail(null)
      }
      setDeleteTarget(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không thể xóa cuộc trò chuyện.')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleMessageReceived = useCallback((msg: ChatMessage) => {
    setActiveDetail((current) => {
      if (current && current.conversation.id === msg.conversationId) {
        if (current.messages.some((m) => m.id === msg.id)) return current
        return {
          ...current,
          messages: [...current.messages, msg],
          conversation: {
            ...current.conversation,
            lastMessageText: msg.content,
            lastMessageAtUtc: msg.sentAtUtc
          }
        }
      }
      return current
    })

    setConversations((prev) => prev.map((c) => {
      if (c.id === msg.conversationId) {
        const isCurrentOpen = activeConversationId === msg.conversationId
        return {
          ...c,
          lastMessageText: msg.content,
          lastMessageAtUtc: msg.sentAtUtc,
          unreadCount: isCurrentOpen || msg.senderUserId === session?.user.id ? 0 : c.unreadCount + 1
        }
      }
      return c
    }))

    if (activeConversationId === msg.conversationId && session && msg.senderUserId !== session.user.id) {
      void api.markConversationRead(msg.conversationId, session.accessToken).catch(() => {})
    }
  }, [activeConversationId, session])

  const handleConversationUpdated = useCallback((conv: Conversation) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === conv.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], ...conv }
        return next
      }
      return [conv, ...prev]
    })
  }, [])

  useChatRealtime(session?.accessToken, activeConversationId, handleMessageReceived, handleConversationUpdated)

  useEffect(() => {
    if (activeDetail?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeDetail?.messages])

  // Click outside to close thread menu or header menu
  useEffect(() => {
    const handleWindowClick = () => {
      setThreadMenuId(null)
      setHeaderMenuOpen(false)
    }
    window.addEventListener('click', handleWindowClick)
    return () => window.removeEventListener('click', handleWindowClick)
  }, [])

  useEffect(() => {
    const handler = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        providerId?: string | null
        providerBusinessName?: string
        topic?: string
        initialMessage?: string
        slotSnippet?: PinnedSlotSnippet
      }>
      if (!session?.accessToken) return
      setIsOpen(true)
      const { providerId, topic = 'Tư vấn dịch vụ', initialMessage = 'Xin chào', slotSnippet } = customEvent.detail
      if (slotSnippet) {
        setPinnedSlot(slotSnippet)
      }
      const existing = conversations.find((c) => (providerId ? c.providerId === providerId : false))
      if (existing) {
        void selectConversation(existing.id)
      } else {
        setLoading(true)
        try {
          const created = await api.createConversation({ providerId, topic, initialMessage }, session.accessToken)
          setConversations((prev) => [created.conversation, ...prev.filter((c) => c.id !== created.conversation.id)])
          setActiveConversationId(created.conversation.id)
          setActiveDetail(created)
        } catch {
          // ignore
        } finally {
          setLoading(false)
        }
      }
    }
    window.addEventListener('openslot:open-chat', handler)
    return () => window.removeEventListener('openslot:open-chat', handler)
  }, [conversations, selectConversation, session])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim() || !activeConversationId || !session?.accessToken || sending) return
    const text = messageText.trim()
    setMessageText('')
    setSending(true)
    try {
      const sent = await api.sendChatMessage(activeConversationId, text, session.accessToken)
      setActiveDetail((current) => {
        if (!current) return null
        if (current.messages.some((m) => m.id === sent.id)) return current
        return {
          ...current,
          messages: [...current.messages, sent],
          conversation: {
            ...current.conversation,
            lastMessageText: sent.content,
            lastMessageAtUtc: sent.sentAtUtc
          }
        }
      })
      setConversations((prev) => prev.map((c) => c.id === activeConversationId ? {
        ...c,
        lastMessageText: sent.content,
        lastMessageAtUtc: sent.sentAtUtc
      } : c))
    } catch {
      setMessageText(text)
    } finally {
      setSending(false)
    }
  }

  // Display counterpart name depending on active role:
  // Provider mode -> display customerName
  // Customer mode -> display providerBusinessName
  const conversationDisplayTitle = useCallback((c: Conversation) => {
    if (currentRole === 'Provider') {
      return c.customerName || 'Khách hàng'
    }
    return c.providerBusinessName || 'Cửa hàng đối tác'
  }, [currentRole])

  // Filter conversations for P2P customer <-> partner
  const p2pConversations = conversations.filter((c) => {
    if (unreadOnly && (c.unreadCount ?? 0) <= 0) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const title = (currentRole === 'Provider' ? c.customerName : c.providerBusinessName || c.topic).toLowerCase()
      return title.includes(q)
    }
    return true
  })

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)

  const roleTag = (role: string) => {
    if (role === 'Provider') return <span className="chat-message-role-tag provider">Cửa hàng</span>
    return null
  }

  // Strictly do NOT render on public external screens for unauthenticated users!
  if (!session || !isEligible) {
    return null
  }

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          className="openslot-chat-trigger"
          onClick={() => {
            setIsOpen(true)
            // Always show the welcome screen first when opening chat from floating trigger button
            setActiveConversationId(null)
            setActiveDetail(null)
            loadConversations()
          }}
          aria-label="Mở khung chat trực tiếp OpenSlot"
        >
          <i className="bi bi-chat-dots-fill" />
          <span>Chat {currentRole === 'Provider' ? '(Đối tác)' : ''}</span>
          {totalUnread > 0 && (
            <span className="chat-unread-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="openslot-webchat-container" role="dialog" aria-label="OpenSlot Web Chat">
          {/* Left Column: Sidebar Conversation List */}
          <div className="openslot-webchat-sidebar">
            <div className="openslot-webchat-sidebar-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-chat-dots-fill text-danger fs-5" />
                <h3>OpenSlot Chat {currentRole === 'Provider' ? '(Đối tác)' : '(Khách)'}</h3>
                {totalUnread > 0 && (
                  <span className="badge bg-danger rounded-pill">{totalUnread}</span>
                )}
              </div>
              <button
                type="button"
                className="btn-close d-md-none"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng"
              />
            </div>

            <div className="openslot-webchat-search">
              <input
                type="text"
                placeholder={currentRole === 'Provider' ? 'Tìm kiếm khách hàng...' : 'Tìm kiếm đối tác, cửa hàng...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="openslot-webchat-filter-tabs">
              <button
                type="button"
                className={!unreadOnly ? 'active' : ''}
                onClick={() => setUnreadOnly(false)}
              >
                Tất cả ({conversations.length})
              </button>
              <button
                type="button"
                className={unreadOnly ? 'active' : ''}
                onClick={() => setUnreadOnly(true)}
              >
                Chưa đọc ({conversations.filter((c) => (c.unreadCount ?? 0) > 0).length})
              </button>
            </div>

            <div className="openslot-webchat-thread-list">
              {p2pConversations.length > 0 ? (
                p2pConversations.map((c) => {
                  const isActive = activeConversationId === c.id
                  const title = conversationDisplayTitle(c)
                  const isMenuOpen = threadMenuId === c.id
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={c.id}
                      className={`openslot-webchat-thread ${isActive ? 'active' : ''}`}
                      onClick={() => selectConversation(c.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void selectConversation(c.id) }}
                    >
                      <div className={`chat-thread-avatar ${currentRole === 'Provider' ? 'customer' : 'provider'}`}>
                        <i className={currentRole === 'Provider' ? 'bi bi-person-fill' : 'bi bi-shop'} />
                      </div>
                      <div className="chat-thread-info">
                        <div className="chat-thread-info-top">
                          <b>{title}</b>
                          <time>{formatTime(c.lastMessageAtUtc)}</time>
                        </div>
                        <p className="chat-thread-snippet">{c.lastMessageText || c.topic}</p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="chat-thread-badge">{c.unreadCount}</span>
                      )}

                      {/* Dropdown Menu & Quick Delete on thread item */}
                      <div className="chat-thread-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="chat-thread-menu-btn"
                          title="Tùy chọn cuộc trò chuyện"
                          aria-label="Tùy chọn"
                          onClick={(e) => {
                            e.stopPropagation()
                            setThreadMenuId((prev) => (prev === c.id ? null : c.id))
                          }}
                        >
                          <i className="bi bi-three-dots-vertical" />
                        </button>
                        {isMenuOpen && (
                          <div className="chat-thread-dropdown-menu" role="menu">
                            <button
                              type="button"
                              className="chat-thread-dropdown-item text-danger"
                              onClick={(e) => {
                                e.stopPropagation()
                                void handleDeleteConversation(c.id, title)
                              }}
                            >
                              <i className="bi bi-trash3-fill me-2" />
                              Xóa cuộc trò chuyện
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-5 text-muted small px-3">
                  <i className="bi bi-chat-dots fs-3 d-block mb-2 text-secondary opacity-50" />
                  <span>
                    {currentRole === 'Provider'
                      ? 'Chưa có khách hàng nào nhắn tin cho cửa hàng của bạn.'
                      : <>Chưa có hội thoại nào.<br />Bấm &ldquo;Chat với cửa hàng&rdquo; tại trang chi tiết slot để bắt đầu trò chuyện.</>}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Main Chat Area */}
          <div className="openslot-webchat-main">
            {activeConversationId && activeDetail ? (
              <>
                <div className="openslot-webchat-main-header">
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-secondary p-0 me-1"
                      onClick={() => {
                        setActiveConversationId(null)
                        setActiveDetail(null)
                      }}
                      title="Quay lại màn hình chào mừng"
                      aria-label="Quay lại"
                    >
                      <i className="bi bi-chevron-left fs-5" />
                    </button>
                    <div>
                      <b>{conversationDisplayTitle(activeDetail.conversation)}</b>
                      <small><i className="bi bi-dot" />Đang hoạt động</small>
                    </div>
                  </div>
                  <div className="openslot-webchat-controls">
                    {/* Header three-dot action menu */}
                    <div className="position-relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setHeaderMenuOpen((prev) => !prev)}
                        title="Tùy chọn cuộc trò chuyện"
                        aria-label="Tùy chọn"
                      >
                        <i className="bi bi-three-dots-vertical" />
                      </button>
                      {headerMenuOpen && (
                        <div className="chat-header-dropdown-menu" role="menu">
                          <button
                            type="button"
                            className="chat-header-dropdown-item text-danger"
                            onClick={() => {
                              setHeaderMenuOpen(false)
                              void handleDeleteConversation(activeDetail.conversation.id, conversationDisplayTitle(activeDetail.conversation))
                            }}
                          >
                            <i className="bi bi-trash3-fill me-2" />
                            Xóa cuộc trò chuyện
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleDeleteConversation(activeDetail.conversation.id, conversationDisplayTitle(activeDetail.conversation))}
                      title="Xóa cuộc trò chuyện này"
                      aria-label="Xóa cuộc trò chuyện này"
                      className="text-danger"
                    >
                      <i className="bi bi-trash" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      title="Thu nhỏ"
                      aria-label="Thu nhỏ"
                    >
                      <i className="bi bi-dash-lg" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false)
                        setActiveConversationId(null)
                        setActiveDetail(null)
                      }}
                      title="Đóng chat"
                      aria-label="Đóng"
                    >
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                </div>

                {pinnedSlot && (
                  <div className="openslot-webchat-pinned-slot">
                    <div className="openslot-webchat-pinned-slot-info">
                      <i className="bi bi-lightning-charge-fill text-danger fs-5" />
                      <div>
                        <b>{pinnedSlot.serviceName}</b>
                        <span><i className="bi bi-building me-1" />{pinnedSlot.venueName}</span>
                      </div>
                    </div>
                    <div className="openslot-webchat-pinned-slot-price">
                      {formatMoney(pinnedSlot.dealPriceVnd)}
                    </div>
                  </div>
                )}

                <div className="chat-messages-area">
                  {loading ? (
                    <div className="empty-state py-4"><div className="spinner-border text-primary spinner-border-sm" /></div>
                  ) : activeDetail.messages.length ? (
                    activeDetail.messages.map((msg) => {
                      const isMine = msg.senderUserId === session.user.id
                      return (
                        <div key={msg.id} className={`chat-message-row ${isMine ? 'mine' : 'theirs'}`}>
                          {!isMine && (
                            <span className="chat-message-author">
                              {msg.senderName}
                              {roleTag(msg.senderRole)}
                            </span>
                          )}
                          <div className="chat-message-bubble">{msg.content}</div>
                          <time className="chat-message-time">{formatTime(msg.sentAtUtc)}</time>
                        </div>
                      )
                    })
                  ) : (
                    <div className="empty-state py-4">
                      <i className="bi bi-chat-heart text-danger" />
                      <p className="small mb-0">
                        {currentRole === 'Provider'
                          ? 'Chưa có tin nhắn nào từ khách hàng.'
                          : 'Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên tới cửa hàng!'}
                      </p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-bar" onSubmit={sendMessage}>
                  <input
                    type="text"
                    placeholder={currentRole === 'Provider' ? 'Nhập tin nhắn trao đổi với khách hàng...' : 'Nhập tin nhắn trao đổi với cửa hàng...'}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    disabled={sending}
                    maxLength={1000}
                  />
                  <button type="submit" disabled={sending || !messageText.trim()} title="Gửi tin nhắn">
                    <i className="bi bi-send-fill" />
                  </button>
                </form>
              </>
            ) : (
              /* Shopee-style Empty Welcome Screen */
              <div className="openslot-webchat-welcome">
                <div className="d-flex align-items-center justify-content-end w-100 p-2 position-absolute top-0 end-0">
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setIsOpen(false)}
                    aria-label="Đóng"
                  />
                </div>
                <div className="openslot-webchat-welcome-illustration">
                  <div className="openslot-welcome-bubble-main">
                    <i className="bi bi-chat-heart-fill" />
                  </div>
                  <div className="openslot-welcome-bubble-secondary">
                    <i className="bi bi-lightning-charge-fill" />
                  </div>
                </div>
                <h4>Chào mừng bạn đến với OpenSlot Chat</h4>
                <p className="openslot-webchat-welcome-subtitle">
                  Hộp thư trực tiếp nhận phản hồi từ Cửa hàng và trao đổi thông tin đặt slot.
                </p>
                <div className="openslot-webchat-welcome-role-badge">
                  <i className="bi bi-shield-check me-1 text-success" />
                  <span>Khu vực {currentRole === 'Provider' ? 'Đối tác quản lý' : 'Khách hàng săn slot'}</span>
                </div>
                <p className="openslot-webchat-welcome-hint">
                  Vui lòng chọn một cuộc trò chuyện từ danh sách bên trái để xem tin nhắn và bắt đầu trò chuyện.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Xóa cuộc trò chuyện"
        message={`Bạn có chắc muốn xóa cuộc trò chuyện với "${deleteTarget?.name}"? Cuộc trò chuyện này sẽ được ẩn khỏi danh sách của bạn và chỉ xuất hiện lại khi có tin nhắn mới.`}
        confirmText="Xóa cuộc trò chuyện"
        cancelText="Hủy bỏ"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDeleteConversation}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
