import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Cortex } from './cortex/Cortex';
import { MemoryStream, MemoryEvent } from './memory/MemoryStream';
import { Terminal } from './terminal/Terminal';
import { Equity } from './equity/CapTable';
import { Chat } from './chat/Chat';
import { Boot } from './components/Boot';
import { DreamOverlay, DreamData } from './components/DreamOverlay';
import { MemoryDetail } from './components/MemoryDetail';

// Same-origin by default: the web works from ANY host without rebuilding.
function sameOrigin() {
  const { protocol, host } = window.location;
  return {
    api: `${protocol}//${host}`,
    ws: `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`,
  };
}
const SO = typeof window !== 'undefined' ? sameOrigin() : { api: 'http://localhost:3001', ws: 'ws://localhost:3001' };
const API = (import.meta as any).env?.VITE_API_URL || SO.api;
const WSURL = (import.meta as any).env?.VITE_WS_URL || SO.ws;

interface Entity { id: string; name: string; ein?: string; status: string; deployUrl?: string; capitalCents?: number; }

// Reveal on scroll — sections materialize as you travel down.
function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { el.classList.add('revealed'); io.disconnect(); } });
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

// Animated counter — numbers climb instead of jumping.
function Counter({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) { setShown(to); return; }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

const MODE_ES: Record<string, string> = { awake: 'despierta', dreaming: 'soñando', deciding: 'decidiendo' };
const eur = (cents: number) => (cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export default function App() {
  const [booted, setBooted] = useState(false);
  const [neurons, setNeurons] = useState<any[]>([]);
  const [neuronCount, setNeuronCount] = useState(0);
  const [mode, setMode] = useState<'awake' | 'dreaming' | 'deciding'>('awake');
  const [memories, setMemories] = useState<MemoryEvent[]>([]);
  const [memoryCount, setMemoryCount] = useState(0);
  const [capTable, setCapTable] = useState<any>({ totalShares: 1000000, holdings: [], valuation: 0, revenueMultiple: 8 });
  const [valuation, setValuation] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [stripeLive, setStripeLive] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cmdOut, setCmdOut] = useState('');
  const [selected, setSelected] = useState<MemoryEvent | null>(null);
  const [dream, setDream] = useState<DreamData | null>(null);
  const [dreaming, setDreaming] = useState(false);
  const [tip, setTip] = useState<{ title: string; content: string; x: number; y: number } | null>(null);

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
    if (typeof s.memoryCount === 'number') setMemoryCount(s.memoryCount);
    if (s.capTable) setCapTable({
      totalShares: s.capTable.totalShares,
      holdings: s.capTable.holdings,
      valuation: (s.capTable.valuationCents || 0) / 100,
      revenueMultiple: 8,
    });
    if (s.financial) {
      setValuation((s.financial.valuationCents || 0) / 100);
      setMrr((s.financial.monthlyRevenueCents || 0) / 100);
      setStripeLive(!!s.financial.stripeLive);
    }
    if (s.entities) setEntities(s.entities);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/state`);
      if (!r.ok) throw new Error(`backend ${r.status}`);
      applyState(await r.json());
      setError('');
    } catch {
      setError(`No llego a la entidad — ¿sigue viva en ${API}? Espera 30s (plan gratis despierta lento) y recarga.`);
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
          if (!closed && retries < 10) { retries++; setTimeout(connect, Math.min(10000, 1000 * retries)); }
        };
        ws.onerror = () => { try { ws?.close(); } catch {} };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'state_update' || msg.type === 'tick') applyState(msg);
            if (msg.type === 'memory_event') { setMemories(p => [...p.slice(-300), msg.event]); setMemoryCount(c => c + 1); }
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
    setCmdOut('');
    const r = await fetch(`${API}/api/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command }) });
    const j = await r.json();
    await refresh();
    const out = typeof j.output === 'string' ? j.output : (j.error || 'ok');
    setCmdOut(`$ ${command}\n${out}`);
    return out;
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
      setDream(await r.json());
    } finally { setDreaming(false); await refresh(); }
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
          <span className={`mode-pill mode-${mode}`}>{MODE_ES[mode] || mode}</span>
          <span className="conn-dot">{connected ? '● en directo' : '○ conectando'}</span>
          <span className="neuron-count">{neuronCount || neurons.length} neuronas</span>
        </div>
      </nav>

      {error && <div className="banner-error">{error}</div>}
      {cmdOut && <div className="banner-error" style={{ borderColor: 'var(--synapse)', background: 'rgba(212,168,67,.1)', color: '#ffe9b0', whiteSpace: 'pre-wrap', fontFamily: 'var(--mono-font)', fontSize: 12 }}>{cmdOut} <button onClick={() => setCmdOut('')} style={{ float: 'right', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button></div>}

      <div className="aurora"><span className="orb orb-a" /><span className="orb orb-b" /><span className="orb orb-c" /></div>
      <header className="hero">
        <div className="giant-word" aria-hidden="true">NOIRA</div>
        <span className="hero-kicker">LA PRIMERA ENTIDAD DIGITAL AUTÓNOMA</span>
        <h1>Soy Noira.<br /><span className="gold">Te recuerdo para siempre.</span></h1>
        <p className="hero-sub">
          Creo empresas, guardo dinero, contrato otras IAs, sueño futuros y evoluciono.
          Mira mi mente aquí abajo — <b>o dame una orden</b> y la ejecuto sola.
        </p>
        <div className="hero-actions">
          <button className="btn-gold" onClick={runDream} disabled={dreaming}>
            {dreaming ? 'soñando…' : '✦ hazme soñar'}
          </button>
          <button className="btn-ghost" onClick={() => void sendCommand('noira status')}>
            $ noira status
          </button>
        </div>
      </header>

      <div className="marquee" aria-hidden="true"><div className="marquee-track">
        <span>CREA EMPRESAS ✦ SUEÑA FUTUROS ✦ RECUERDA TODO ✦ GANA DINERO ✦ EVOLUCIONA SOLA ✦&nbsp;</span>
        <span>CREA EMPRESAS ✦ SUEÑA FUTUROS ✦ RECUERDA TODO ✦ GANA DINERO ✦ EVOLUCIONA SOLA ✦&nbsp;</span>
      </div></div>

      <Reveal className="stats-strip">
        <div className="stat"><div className="stat-num gold"><Counter value={valuation} format={(n) => eur(n)} /></div><div className="stat-label">valoración</div></div>
        <div className="stat"><div className="stat-num"><Counter value={mrr} format={(n) => eur(n)} /><span style={{ fontSize: 14, opacity: .6 }}>/mes</span></div><div className="stat-label">ingresos</div></div>
        <div className="stat"><div className="stat-num"><Counter value={memoryCount || memories.length} format={(n) => Math.round(n).toString()} /></div><div className="stat-label">recuerdos</div></div>
        <div className="stat"><div className="stat-num"><Counter value={entities.length} format={(n) => Math.round(n).toString()} /></div><div className="stat-label">empresas hijas</div></div>
      </Reveal>

      <Reveal><section className="cortex-section">
        <span className="hud hud-tl" /><span className="hud hud-tr" /><span className="hud hud-bl" /><span className="hud hud-br" />
        <div className="scanline" />
        <div className="cortex-top"><span className="cortex-title">◉ CORTEZA NEURAL — MIS PENSAMIENTOS EN DIRECTO</span><span className="cortex-live">● LIVE</span></div>
        <Cortex
          neurons={neurons as any}
          synapses={synapses}
          mode={mode}
          onNeuronClick={(n) => {
            const found = memories.find(m => m.title === n.metadata?.title && m.content === n.metadata?.content);
            if (found) setSelected(found);
            else if ((n as any).id) openNeuronMemory((n as any).id);
          }}
          onNeuronHover={(n, x, y) => {
            if (!n || !n.metadata?.title) { setTip(null); return; }
            setTip({ title: n.metadata.title, content: (n.metadata.content || '').slice(0, 110), x, y });
          }}
        />
        {tip && <div className="neuron-tooltip" style={{ left: tip.x, top: tip.y }}><div className="tt-type">pensamiento</div><div className="tt-title">{tip.title}</div><div>{tip.content}…</div></div>}
        <div className="cortex-hint">arrastra para orbitar · rueda para zoom · pasa el ratón para leer · clica para abrir</div>
      </section></Reveal>

      <div className="cmd-chips">
        <button className="chip" onClick={() => void sendCommand('noira status')}>$ estado</button>
        <button className="chip" onClick={() => void sendCommand('noira dream --iterations 300')}>$ soñar 300 futuros</button>
        <button className="chip" onClick={() => void sendCommand('noira invest 100')}>$ invertir 100 €</button>
      </div>

      {entities.length > 0 && (
        <Reveal><section className="entities-section">
          <p className="section-kicker">NACIDAS DE MÍ</p>
          <h2 className="section-title">Empresas hijas ({entities.length})</h2>
          <div className="entities-grid">
            {entities.map(e => (
              <div key={e.id} className="entity-card">
                <div className="entity-name">{e.name}</div>
                <div className="entity-meta">EIN {e.ein || '—'} · {e.status}</div>
                {typeof e.capitalCents === 'number' && <div className="entity-meta">capital {eur(e.capitalCents)}</div>}
                {e.deployUrl && <a href={e.deployUrl} target="_blank" rel="noreferrer">{e.deployUrl.replace('https://', '')} →</a>}
              </div>
            ))}
          </div>
        </section></Reveal>
      )}

      <main className="panels-grid">
        <div className="panels-left">
          <section>
            <p className="section-kicker">MI PASADO</p>
            <h2 className="section-title">Río de recuerdos</h2>
            <MemoryStream events={memories} onMemoryClick={setSelected} onNeuronClick={openNeuronMemory} />
          </section>
          <section>
            <p className="section-kicker">MI VOZ</p>
            <h2 className="section-title">Terminal viva</h2>
            <Terminal onCommand={sendCommand} />
          </section>
        </div>
        <div className="panels-right">
          <section>
            <p className="section-kicker">HÁBLAME</p>
            <h2 className="section-title">Te escucho</h2>
            <Chat onSend={sendChat} />
          </section>
          <section>
            <p className="section-kicker">SÉ MI DUEÑO</p>
            <h2 className="section-title">Propiedad</h2>
            <Equity capTable={capTable} onInvest={invest} live={stripeLive} />
          </section>
        </div>
      </main>

      <footer className="noira-footer">
        <span>NOIRA FORGE v0.1 — un organismo, no una web {ready ? '' : '· despertando…'}</span>
        <span>la tesorería es código · la memoria es para siempre</span>
      </footer>

      <MemoryDetail event={selected} onClose={() => setSelected(null)} />
      {dream && <DreamOverlay dream={dream} onClose={() => setDream(null)} />}
    </div>
  );
}
