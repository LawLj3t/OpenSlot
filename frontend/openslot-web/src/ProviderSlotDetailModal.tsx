import React from 'react'
import type { ProviderSlot } from './types'

export interface ProviderSlotDetailModalProps {
  slot: ProviderSlot | null
  onClose: () => void
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value)

const formatTime = (value?: string | null) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const formatSlotWindow = (startAtUtc: string, endAtUtc: string) => {
  const start = formatTime(startAtUtc)
  const end = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(endAtUtc))
  return `${start} – ${end}`
}

export const ProviderSlotDetailModal: React.FC<ProviderSlotDetailModalProps> = ({ slot, onClose }) => {
  if (!slot) return null

  const remainingSpots = Math.max(0, slot.capacity - slot.confirmedBookingCount - slot.activeHoldCount)
  const discountPercent =
    slot.originalPriceVnd > slot.dealPriceVnd
      ? Math.round(((slot.originalPriceVnd - slot.dealPriceVnd) / slot.originalPriceVnd) * 100)
      : 0

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="badge bg-secondary fs-6">Nháp</span>
      case 1:
        return <span className="badge bg-success fs-6">Đang mở bán</span>
      case 2:
        return <span className="badge bg-warning text-dark fs-6">Kín chỗ</span>
      case 3:
        return <span className="badge bg-dark fs-6">Hết hạn</span>
      case 4:
        return <span className="badge bg-danger fs-6">Đã dừng / hủy</span>
      default:
        return <span className="badge bg-secondary fs-6">Không xác định</span>
    }
  }

  return (
    <div className="confirm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="confirm-modal-body slot-detail-modal-body"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="confirm-modal-header pb-2 mb-3 border-bottom d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-clock-history text-primary fs-4" />
            <div>
              <h5 className="m-0 fw-bold">{slot.serviceName}</h5>
              <small className="text-muted">{slot.venueName}</small>
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {getStatusBadge(slot.status)}
            <button
              type="button"
              className="btn-close ms-2"
              aria-label="Đóng"
              onClick={onClose}
            />
          </div>
        </div>

        <div className="slot-detail-content d-flex flex-column gap-3">
          {/* Khung giờ trải nghiệm */}
          <div className="p-3 bg-light rounded-3 border">
            <h6 className="fw-bold mb-2 text-primary d-flex align-items-center gap-2">
              <i className="bi bi-calendar3" /> Khung giờ trải nghiệm
            </h6>
            <div className="row g-2">
              <div className="col-12">
                <span className="text-muted d-block small">Thời gian slot:</span>
                <b className="fs-6">{formatSlotWindow(slot.startAtUtc, slot.endAtUtc)}</b>
              </div>
              <div className="col-sm-6">
                <span className="text-muted d-block small">Mở nhận đặt từ:</span>
                <span>{formatTime(slot.bookingOpensAtUtc)}</span>
              </div>
              <div className="col-sm-6">
                <span className="text-muted d-block small">Đóng nhận đặt lúc:</span>
                <span>{formatTime(slot.bookingClosesAtUtc)}</span>
              </div>
            </div>
          </div>

          {/* Địa điểm & Đơn vị đặt chỗ */}
          <div className="p-3 bg-light rounded-3 border">
            <h6 className="fw-bold mb-2 text-primary d-flex align-items-center gap-2">
              <i className="bi bi-geo-alt-fill" /> Địa điểm & Chỗ nhận đặt
            </h6>
            <div className="row g-2">
              <div className="col-sm-6">
                <span className="text-muted d-block small">Địa điểm:</span>
                <b>{slot.venueName}</b>
                {slot.venueAddress && <small className="d-block text-secondary">{slot.venueAddress}</small>}
              </div>
              <div className="col-sm-6">
                <span className="text-muted d-block small">Chỗ đặt (Sân/Bàn/Phòng):</span>
                <b>{slot.resourceName}</b>
                {slot.resourceCode && (
                  <span className="badge bg-secondary-subtle text-secondary-emphasis ms-2 border">
                    {slot.resourceCode}
                  </span>
                )}
                <div className="small text-muted mt-1">
                  {slot.resourceType && <span>Loại: {slot.resourceType} · </span>}
                  {slot.floorOrZone && <span>Khu: {slot.floorOrZone} · </span>}
                  {slot.positionDescription && <span>{slot.positionDescription}</span>}
                </div>
              </div>
              {slot.categoryName && (
                <div className="col-12 pt-1">
                  <span className="text-muted d-block small">Ngành nghề dịch vụ:</span>
                  <span className="badge bg-primary-subtle text-primary border">{slot.categoryName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Giá & Sức chứa */}
          <div className="p-3 bg-light rounded-3 border">
            <h6 className="fw-bold mb-2 text-primary d-flex align-items-center gap-2">
              <i className="bi bi-tag-fill" /> Giá deal & Tình trạng đặt chỗ
            </h6>
            <div className="row g-2 text-center">
              <div className="col-6 col-sm-3 p-2 border-end">
                <span className="text-muted d-block small">Giá ưu đãi</span>
                <b className="fs-5 text-danger">{formatMoney(slot.dealPriceVnd)}</b>
                {discountPercent > 0 && (
                  <small className="badge bg-danger-subtle text-danger d-block mt-1">-{discountPercent}%</small>
                )}
              </div>
              <div className="col-6 col-sm-3 p-2 border-end">
                <span className="text-muted d-block small">Giá gốc</span>
                <del className="text-muted d-block fs-6">{formatMoney(slot.originalPriceVnd)}</del>
              </div>
              <div className="col-6 col-sm-3 p-2 border-end">
                <span className="text-muted d-block small">Đã xác nhận</span>
                <b className="fs-5 text-success">{slot.confirmedBookingCount}</b>
                <small className="text-muted d-block">/ {slot.capacity} chỗ</small>
              </div>
              <div className="col-6 col-sm-3 p-2">
                <span className="text-muted d-block small">Còn trống</span>
                <b className={`fs-5 ${remainingSpots === 0 ? 'text-secondary' : 'text-primary'}`}>
                  {remainingSpots}
                </b>
                {slot.activeHoldCount > 0 && (
                  <small className="text-warning-emphasis d-block">({slot.activeHoldCount} đang giữ chỗ)</small>
                )}
              </div>
            </div>
          </div>

          {/* Lịch sử kiểm toán */}
          <div className="px-3 py-2 text-muted small d-flex justify-content-between flex-wrap gap-2 border-top pt-2">
            <span>
              Tạo lúc: <b>{formatTime(slot.createdAtUtc)}</b>
            </span>
            {slot.publishedAtUtc && (
              <span>
                Phát hành: <b>{formatTime(slot.publishedAtUtc)}</b>
              </span>
            )}
            <span>
              Mã slot: <code className="user-select-all">{slot.id}</code>
            </span>
          </div>
        </div>

        <div className="confirm-modal-footer mt-3 pt-3 border-top d-flex justify-content-end">
          <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
