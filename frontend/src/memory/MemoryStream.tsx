import { useEffect, useState } from 'react'

export interface MemoryEvent {
  id: string
  timestamp: number
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision' | 'financial' | 'hired' | 'evolution'
  title: string
  content: string
  metadata: Record<string, any>
  neuronId?: string
  importance: number
}

export interface MemoryStreamProps {
  events: MemoryEvent[]
  onMemoryClick: (event: MemoryEvent) => void
  onNeuronClick?: (neuronId: string) => void
}

export const MemoryStream: React.FC<MemoryStreamProps> = ({
  events,
  onMemoryClick,
  onNeuronClick
}) => {
  const [scrollPos, setScrollPos] = useState(0)

  useEffect(() => {
    // Auto-scroll to bottom on new events
    const container = document.querySelector('.memory-container') as HTMLDivElement
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [events.length])

  void scrollPos;

  return (
    <div
      className="memory-container"
      onScroll={(e) => setScrollPos((e.currentTarget as HTMLDivElement).scrollTop)}
    >
      <div className="memory-header">
        <h3>Río de recuerdos</h3>
        <span className="memory-count">
          {events.length} pensamientos
        </span>
      </div>
      
      <div className="memory-list">
        {events.map((event, index) => (
          <div
            key={event.id}
            className="memory-item"
            onClick={() => {
              onMemoryClick(event);
              if (event.neuronId) onNeuronClick?.(event.neuronId);
            }}
            style={{
              animationDelay: `${index * 0.02}s`,
              opacity: event.importance > 0.7 ? 1 : 0.6
            }}
          >
            <div className="memory-type-badge"
                 style={{ background: event.importance > 0.8 ? 'var(--synapse-gold)' : 'var(--axon-blue)' }}>
              {event.type}
            </div>
            <div className="memory-title">{event.title}</div>
            <div className="memory-meta">
              {new Date(event.timestamp).toLocaleString('es-ES')} •
              importancia {Math.round(event.importance * 10)}/10
            </div>
          </div>
        ))}
      </div>
      
      {events.length === 0 && (
        <div className="memory-empty">
          Aún sin pensamientos. Espera a que Noira despierte.
        </div>
      )}
    </div>
  )
}