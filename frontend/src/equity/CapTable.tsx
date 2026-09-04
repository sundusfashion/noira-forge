import { useState } from 'react'

export interface Holding {
  address: string
  shares: number
  percentage: number
  type: 'founder' | 'investor' | 'employee' | 'treasury'
  tokens?: string
}

export interface CapTable {
  totalShares: number
  holdings: Holding[]
  valuation: number
  revenueMultiple: number
}

export interface EquityProps {
  capTable: CapTable
  onInvest: (amount: number) => Promise<void>
  live?: boolean
}

export const Equity: React.FC<EquityProps> = ({
  capTable,
  onInvest,
  live
}) => {
  const [amount, setAmount] = useState('100')

  const renderHolding = (holding: Holding) => (
    <div className="equity-holding" style={{
      borderLeft: `4px solid ${holding.type === 'founder' ? 'var(--dopamine-red)' :
                         holding.type === 'investor' ? 'var(--melancholy-purple)' :
                         holding.type === 'employee' ? 'var(--axon-blue)' : 'var(--synapse-gold)'}`
    }}>
      <div className="holding-info">
        <span className="holding-address"
              style={{ color: holding.type === 'founder' ? 'var(--dopamine-red)' : 'var(--axon-blue)' }}>
          {holding.address.slice(0, 6)}...{holding.address.slice(-4)}
        </span>
        <span className="holding-shares">
          {holding.shares.toLocaleString()} shares
        </span>
        <span className="holding-percentage">
          {holding.percentage.toFixed(1)}%
        </span>
      </div>
      <div className="holding-visual">
        <div className="holding-bar" 
             style={{ width: `${holding.percentage}%` }} />
      </div>
    </div>
  )

  return (
    <div className="equity-panel">
      <div className="equity-header">
        <h3>Equity Ownership {live
          ? <span className="pay-badge pay-live">● card live</span>
          : <span className="pay-badge pay-sandbox">○ ledger mode — card activates with keys</span>}</h3>
        <div className="equity-valuation">
          <span>Valuation: ${capTable.valuation.toLocaleString()}</span>
          <span>• Multiple: {capTable.revenueMultiple.toFixed(1)}x Revenue</span>
        </div>
      </div>

      <div className="equity-list">
        {capTable.holdings.map((holding, i) => (
          <div key={i} className="equity-row">
            {renderHolding(holding)}
          </div>
        ))}
      </div>

      <div className="equity-invest">
        <input
          value={amount}
          onChange={e => setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          style={{ width: 90, background: 'rgba(0,0,0,.5)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', padding: '10px 12px', borderRadius: 6 }}
        />
        <button
          onClick={() => {
            const v = Math.min(Math.max(Number(amount) || 0, 10), 1000);
            void onInvest(v);
          }}
          className="equity-invest-btn"
        >
          Invest ${amount || '0'}
        </button>
        <span>Min: $10 | Max: $1000 per transaction</span>
      </div>

      <div className="equity-stats">
        <div>
          <span>Total Holdings</span>
          <span>{capTable.holdings.length}</span>
        </div>
        <div>
          <span>Active Companies</span>
          <span>{Math.round(Math.random() * 5 + 2)}</span>
        </div>
      </div>
    </div>
  )
}