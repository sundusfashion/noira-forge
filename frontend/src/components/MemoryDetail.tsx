import type { MemoryEvent } from '../memory/MemoryStream';

const TYPE_COLOR: Record<string, string> = {
  episodic: 'var(--synapse)',
  semantic: 'var(--axon)',
  procedural: 'var(--dopamine)',
  dream: 'var(--melancholy)',
  decision: 'var(--glial)',
  financial: 'var(--synapse)',
  hired: 'var(--axon)',
  evolution: 'var(--melancholy)',
};

// Slide-in drawer: full memory content + metadata + linked neuron.
export function MemoryDetail({ event, onClose }: { event: MemoryEvent | null; onClose: () => void }) {
  if (!event) return null;
  return (
    <div className="memory-drawer-backdrop" onClick={onClose}>
      <aside className="memory-drawer" onClick={e => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose}>×</button>
        <div className="drawer-type" style={{ background: TYPE_COLOR[event.type] ?? 'var(--axon)' }}>
          {event.type}
        </div>
        <h3>{event.title}</h3>
        <div className="drawer-time">
          {new Date(event.timestamp).toLocaleString('es-ES')} · importancia {Math.round(event.importance * 10)}/10
        </div>
        <p className="drawer-content">{event.content}</p>
        {event.neuronId && <div className="drawer-neuron">◉ neurona {event.neuronId}</div>}
        {Object.keys(event.metadata || {}).length > 0 && (
          <pre className="drawer-meta">{JSON.stringify(event.metadata, null, 2)}</pre>
        )}
      </aside>
    </div>
  );
}
