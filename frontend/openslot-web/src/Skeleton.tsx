import React from 'react'

export const SlotCardSkeleton: React.FC = () => (
  <div className="slot-card os-skeleton-card" style={{ pointerEvents: 'none' }}>
    <div className="os-skeleton" style={{ height: '175px', borderRadius: '16px 16px 0 0' }} />
    <div className="slot-body" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div className="os-skeleton" style={{ width: '70px', height: '14px' }} />
        <div className="os-skeleton" style={{ width: '50px', height: '14px' }} />
      </div>
      <div className="os-skeleton" style={{ width: '85%', height: '20px', marginBottom: '10px' }} />
      <div className="os-skeleton" style={{ width: '60%', height: '14px', marginBottom: '14px' }} />
      <div className="os-skeleton" style={{ width: '100%', height: '1px', marginBottom: '12px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="os-skeleton" style={{ width: '50px', height: '12px', marginBottom: '4px' }} />
          <div className="os-skeleton" style={{ width: '80px', height: '22px' }} />
        </div>
        <div className="os-skeleton" style={{ width: '34px', height: '34px', borderRadius: '50%' }} />
      </div>
    </div>
  </div>
)

export const SlotGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="slot-grid">
    {Array.from({ length: count }).map((_, index) => (
      <SlotCardSkeleton key={index} />
    ))}
  </div>
)

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <div className="table-row" style={{ pointerEvents: 'none' }}>
    {Array.from({ length: columns }).map((_, i) => (
      <div key={i} className="os-skeleton" style={{ height: '20px', width: i === 0 ? '70%' : '50%' }} />
    ))}
  </div>
)

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ rows = 4, columns = 5 }) => (
  <div className="provider-table">
    {Array.from({ length: rows }).map((_, i) => (
      <TableRowSkeleton key={i} columns={columns} />
    ))}
  </div>
)

export const MetricsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="admin-stats">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="os-card" style={{ padding: '16px' }}>
        <div className="os-skeleton" style={{ width: '60px', height: '14px', marginBottom: '8px' }} />
        <div className="os-skeleton" style={{ width: '90px', height: '28px' }} />
      </div>
    ))}
  </div>
)
