import { useEffect, useRef, useState } from 'react';

export interface TerminalLine {
  text: string;
  ok?: boolean;
  echo?: boolean;
}

export interface TerminalProps {
  onCommand: (command: string) => Promise<string | void>;
}

export function Terminal({ onCommand }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { text: 'noira-forge shell — type "noira status" to begin', ok: true },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bufRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bufRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  async function run(cmd: string) {
    const command = cmd.trim();
    if (!command || busy) return;
    setLines(p => [...p, { text: `$ ${command}`, echo: true }]);
    setInput('');
    setBusy(true);
    try {
      const out = await onCommand(command);
      const text = typeof out === 'string' && out.length ? out : 'ok';
      for (const chunk of text.split('\n').slice(0, 30)) {
        setLines(p => [...p.slice(-200), { text: chunk || ' ', ok: true }]);
      }
    } catch (e: any) {
      setLines(p => [...p.slice(-200), { text: `error: ${e?.message || 'failed'}`, ok: false }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-wrapper">
      <div className="terminal-header">
        <span>NOIRA TERMINAL</span>
        <span className="terminal-status" style={{ color: busy ? 'var(--dopamine)' : 'var(--axon)' }}>
          {busy ? 'running' : 'idle'}
        </span>
      </div>
      <div className="terminal-buffer" ref={bufRef}>
        {lines.map((l, i) => (
          <div key={i} className={l.echo ? '' : l.ok === false ? 'output-error' : 'output-success'}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="terminal-input-area">
        <input
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void run(input); }}
          placeholder={busy ? 'executing…' : '$ noira status'}
          disabled={busy}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
