import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { useChatRealtime } from './realtime'
import type { ChatMessage, Conversation, ConversationDetail, Session } from './types'

const formatMoney = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)
const formatTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value))

export type PinnedSlotSnippet = {
  id?: string
  serviceName: string
  venueName: string
  dealPriceVnd: number
}

export function ShopeeWebChat({ session }: { session: Session | null }) {
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const isEligible = Boolean(session && (session.user.roles.includes('Customer') || session.user.roles.includes('Provider')))

  const loadConversations = useCallback(() => {
    if (!session) return
    api.chatConversations(session.accessToken)
      .then(setConversations)
      .catch(() => setConversations([]))
  }, [session])

  useEffect(() => {
    if (session && isEligible) {
      loadConversations()
    }
  }, [isEligible, loadConversations, session])

  const selectConversation = useCallback(async (id: string) => {
    if (!session) return
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

  // Filter conversations for P2P customer <-> partner
  const p2pConversations = conversations.filter((c) => {
    if (!c.providerId && !c.providerBusinessName) return false
    if (unreadOnly && (c.unreadCount ?? 0) <= 0) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const title = (c.providerBusinessName || c.customerName || c.topic).toLowerCase()
      return title.includes(q)
    }
    return true
  })

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0)

  const roleTag = (role: string) => {
    if (role === 'Provider') return <span className="chat-message-role-tag provider">Cửa hàng</span>
    return null
  }

  const conversationDisplayTitle = (c: Conversation) => {
    const isCustomer = session ? session.activeRole === 'Customer' || (!session.activeRole && session.user.roles.includes('Customer')) : true
    if (isCustomer) {
      return c.providerBusinessName || 'Cửa hàng đối tác'
    }
    return c.customerName || 'Khách hàng'
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
          className="shopee-chat-trigger"
          onClick={() => {
            setIsOpen(true)
            loadConversations()
          }}
          aria-label="Mở khung chat trực tiếp Shopee"
        >
          <i className="bi bi-chat-dots-fill" />
          <span>Chat</span>
          {totalUnread > 0 && (
            <span className="chat-unread-badge">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          )}
        </button>
      )}

      {isOpen && (
        <div className="shopee-webchat-container" role="dialog" aria-label="Shopee Web Chat">
          {/* Left Column: Sidebar Conversation List */}
          <div className="shopee-webchat-sidebar">
            <div className="shopee-webchat-sidebar-header">
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-chat-text-fill text-danger fs-5" />
                <h3>Trò chuyện</h3>
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

            <div className="shopee-webchat-search">
              <input
                type="text"
                placeholder="Tìm kiếm đối tác, khách hàng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="shopee-webchat-filter-tabs">
              <button
                type="button"
                className={!unreadOnly ? 'active' : ''}
                onClick={() => setUnreadOnly(false)}
              >
                Tất cả ({conversations.filter((c) => c.providerId || c.providerBusinessName).length})
              </button>
              <button
                type="button"
                className={unreadOnly ? 'active' : ''}
                onClick={() => setUnreadOnly(true)}
              >
                Chưa đọc ({conversations.filter((c) => (c.unreadCount ?? 0) > 0).length})
              </button>
            </div>

            <div className="shopee-webchat-thread-list">
              {p2pConversations.length > 0 ? (
                p2pConversations.map((c) => {
                  const isActive = activeConversationId === c.id
                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={c.id}
                      className={`shopee-webchat-thread ${isActive ? 'active' : ''}`}
                      onClick={() => selectConversation(c.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void selectConversation(c.id) }}
                    >
                      <div className="chat-thread-avatar provider">
                        <i className="bi bi-shop" />
                      </div>
                      <div className="chat-thread-info">
                        <div className="chat-thread-info-top">
                          <b>{conversationDisplayTitle(c)}</b>
                          <time>{formatTime(c.lastMessageAtUtc)}</time>
                        </div>
                        <p className="chat-thread-snippet">{c.lastMessageText || c.topic}</p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="chat-thread-badge">{c.unreadCount}</span>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-5 text-muted small px-3">
                  <i className="bi bi-chat-dots fs-3 d-block mb-2 text-secondary opacity-50" />
                  <span>Chưa có hội thoại nào.<br />Bấm &ldquo;Chat với cửa hàng&rdquo; tại trang chi tiết slot để bắt đầu trò chuyện.</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Main Chat Area */}
          <div className="shopee-webchat-main">
            {activeConversationId && activeDetail ? (
              <>
                <div className="shopee-webchat-main-header">
                  <div>
                    <b>{conversationDisplayTitle(activeDetail.conversation)}</b>
                    <small><i className="bi bi-dot" />Đang hoạt động</small>
                  </div>
                  <div className="shopee-webchat-controls">
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
                  <div className="shopee-webchat-pinned-slot">
                    <div className="shopee-webchat-pinned-slot-info">
                      <i className="bi bi-lightning-charge-fill text-danger fs-5" />
                      <div>
                        <b>{pinnedSlot.serviceName}</b>
                        <span><i className="bi bi-building me-1" />{pinnedSlot.venueName}</span>
                      </div>
                    </div>
                    <div className="shopee-webchat-pinned-slot-price">
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
                      <p className="small mb-0">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên tới cửa hàng!</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-bar" onSubmit={sendMessage}>
                  <input
                    type="text"
                    placeholder="Nhập tin nhắn trao đổi với cửa hàng..."
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
              <div className="shopee-webchat-welcome">
                <div className="d-flex align-items-center justify-content-end w-100 p-2 position-absolute top-0 end-0">
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setIsOpen(false)}
                    aria-label="Đóng"
                  />
                </div>
                <i className="bi bi-chat-dots-fill" />
                <h4>Shopee Web Chat</h4>
                <p>Chào mừng bạn đến với kênh trò chuyện trực tiếp giữa Khách hàng và Cửa hàng đối tác trên OpenSlot.</p>
                <small className="text-muted">Chọn một cuộc trò chuyện ở danh sách bên trái hoặc nhắn tin từ trang ưu đãi của cửa hàng.</small>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
