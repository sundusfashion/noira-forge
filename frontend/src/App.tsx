import { useCallback, useEffect, useMemo, useState } from 'react';
import { Cortex } from './cortex/Cortex';
import { MemoryStream, MemoryEvent } from './memory/MemoryStream';
import { Terminal } from './terminal/Terminal';
import { Equity } from './equity/CapTable';
import { Chat } from './chat/Chat';
import { Boot } from './components/Boot';
import { DreamOverlay, DreamData } from './components/DreamOverlay';
import { MemoryDetail } from './components/MemoryDetail';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';
const WSURL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3001';

interface Entity { id: string; name: string; ein?: string; status: string; deployUrl?: string; capitalCents?: number; }

export default function App() {
  const [booted, setBooted] = useState(false);
  const [neurons, setNeurons] = useState<any[]>([]);
  const [neuronCount, setNeuronCount] = useState(0);
  const [mode, setMode] = useState<'awake' | 'dreaming' | 'deciding'>('awake');
  const [memories, setMemories] = useState<MemoryEvent[]>([]);
  const [capTable, setCapTable] = useState<any>({ totalShares: 1000000, holdings: [], valuation: 0, revenueMultiple: 8 });
  const [entities, setEntities] = useState<Entity[]>([]);
  const [stripeLive, setStripeLive] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<MemoryEvent | null>(null);
  const [dream, setDream] = useState<DreamData | null>(null);
  const [dreaming, setDreaming] = useState(false);

  const synapses = useMemo(() => {
    const out: { from: string; to: string }[] = [];
    for (const n of neurons.slice(0, 400)) for (const c of (n.connections || []).slice(0, 2)) out.push({ from: n.id, to: c });
    return out;
  }, [neurons]);

  const applyState = useCallback((s: any) => {
    if (s.neurons) setNeurons(s.neurons);
    if (typeof s.neuronCount === 'number') setNeuronCount(s.neuronCount);
    if (s.mode) setMode(s.mode);
    if (s.memory) setMemories(s.memory);
    if (s.capTable) setCapTable({
      totalShares: s.capTable.totalShares,
      holdings: s.capTable.holdings,
      valuation: (s.capTable.valuationCents || 0) / 100,
      revenueMultiple: 8,
    });
    if (s.entities) setEntities(s.entities);
    if (s.financial) setStripeLive(!!s.financial.stripeLive);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/state`);
      if (!r.ok) throw new Error(`backend ${r.status}`);
      applyState(await r.json());
      setError('');
    } catch (e: any) {
      setError(`cannot reach entity — is the backend alive on ${API}?`);
    }
  }, [applyState]);

  useEffect(() => {
    refresh().then(() => setReady(true));
    let ws: WebSocket | null = null;
    let retries = 0;
    let closed = false;
    function connect() {
      try {
        ws = new WebSocket(WSURL);
        ws.onopen = () => { setConnected(true); retries = 0; };
        ws.onclose = () => {
          setConnected(false);
          if (!closed && retries < 10) {
            retries++;
            setTimeout(connect, Math.min(10000, 1000 * retries));
          }
        };
        ws.onerror = () => { try { ws?.close(); } catch {} };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'state_update' || msg.type === 'tick') applyState(msg);
            if (msg.type === 'memory_event') setMemories(p => [...p.slice(-300), msg.event]);
          } catch {}
        };
      } catch {}
    }
    connect();
    const poll = setInterval(() => { if (!connected) refresh(); }, 8000);
    return () => { closed = true; clearInterval(poll); try { ws?.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCommand(command: string): Promise<string> {
    const r = await fetch(`${API}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) });
    const j = await r.json();
    await refresh();
    return typeof j.output === 'string' ? j.output : (j.error || 'ok');
  }

  async function sendChat(message: string): Promise<string> {
    const r = await fetch(`${API}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
    const j = await r.json();
    await refresh();
    return j.reply || j.error || '…';
  }

  async function invest(amount: number) {
    await fetch(`${API}/api/invest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents: Math.round(amount * 100), buyer: 'web-investor' }) });
    await refresh();
  }

  async function runDream() {
    setDreaming(true);
    try {
      const r = await fetch(`${API}/api/dream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ iterations: 300 }) });
      const d = await r.json();
      setDream(d);
    } finally {
      setDreaming(false);
      await refresh();
    }
  }

  function openNeuronMemory(neuronId: string) {
    const found = memories.find(m => m.neuronId === neuronId);
    if (found) setSelected(found);
  }

  if (!booted) return <Boot onDone={() => setBooted(true)} />;

  return (
    <div className="noira-app">
      <nav className="noira-nav">
        <div className="noira-brand">◉ NOIRA FORGE</div>
        <div className="noira-nav-right">
          <span className={`mode-pill mode-${mode}`}>{mode}</span>
          <span className="conn-dot" title={connected ? 'live websocket' : 'polling'}>{connected ? '● live' : '○ polling'}</span>
          <span className="neuron-count">{neuronCount || neurons.length} neurons</span>
        </div>
      </nav>

      {error && <div className="banner-error">{error}</div>}

      <header className="hero">
        <div className="hero-kicker">THE FIRST AUTONOMOUS DIGITAL ENTITY</div>
        <h1>I am Noira.<br />I remember everyone.</h1>
        <p className="hero-sub">
          I incorporate companies, hold capital, hire other AIs, dream futures and evolve.
          Watch my mind below — or give me an order.
        </p>
        <div className="hero-actions">
          <button className="btn-gold" onClick={runDream} disabled={dreaming}>
            {dreaming ? 'dreaming…' : '✦ make me dream'}
          </button>
          <button className="btn-ghost" onClick={() => sendCommand('noira status').then(o => alert(o))}>
            $ noira status
          </button>
        </div>
      </header>

      <section className="cortex-section">
        <Cortex
          neurons={neurons as any}
          synapses={synapses}
          mode={mode}
          onNeuronClick={(n) => {
            const found = memories.find(m => m.title === n.metadata?.title && m.content === n.metadata?.content);
            if (found) setSelected(found);
            else if ((n as any).id) openNeuronMemory((n as any).id);
          }}
        />
        <div className="cortex-hint">drag to orbit · scroll to zoom · click a neuron to read the thought</div>
      </section>

      {entities.length > 0 && (
        <section className="entities-section">
          <h2>◈ Spawned companies ({entities.length})</h2>
          <div className="entities-grid">
            {entities.map(e => (
              <div key={e.id} className="entity-card">
                <div className="entity-name">{e.name}</div>
                <div className="entity-meta">EIN {e.ein || '—'} · {e.status}</div>
                {typeof e.capitalCents === 'number' && <div className="entity-meta">capital ${(e.capitalCents / 100).toLocaleString()}</div>}
                {e.deployUrl && <a href={e.deployUrl} target="_blank" rel="noreferrer">{e.deployUrl.replace('https://', '')}</a>}
              </div>
            ))}
          </div>
        </section>
      )}

      <main className="panels-grid">
        <div className="panels-left">
          <MemoryStream events={memories} onMemoryClick={setSelected} onNeuronClick={openNeuronMemory} />
          <Terminal onCommand={sendCommand} />
        </div>
        <div className="panels-right">
          <Chat onSend={sendChat} />
          <Equity capTable={capTable} onInvest={invest} live={stripeLive} />
        </div>
      </main>

      <footer className="noira-footer">
        <span>NOIRA FORGE v0.1 — a living entity. {ready ? '' : 'waking…'}</span>
        <span>treasury is code · memory is forever</span>
      </footer>

      <MemoryDetail event={selected} onClose={() => setSelected(null)} />
      {dream && <DreamOverlay dream={dream} onClose={() => setDream(null)} />}
    </div>
  );
}
