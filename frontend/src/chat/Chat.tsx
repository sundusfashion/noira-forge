import { useState, useRef, useEffect } from 'react';

export interface ChatMessage { id: string; role: 'user' | 'noira'; content: string; timestamp: number; }

export function Chat({ onSend, initialMessages = [] as ChatMessage[] }: { onSend: (m: string) => Promise<string>; initialMessages?: ChatMessage[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput(''); setBusy(true);
    const um: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: text, timestamp: Date.now() };
    setMessages(p => [...p, um]);
    try {
      const reply = await onSend(text);
      setMessages(p => [...p, { id: `n_${Date.now()}`, role: 'noira', content: reply, timestamp: Date.now() }]);
    } catch (e: any) {
      setMessages(p => [...p, { id: `e_${Date.now()}`, role: 'noira', content: `Signal lost: ${e.message}`, timestamp: Date.now() }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header"><span>Noira speaks</span><span className="chat-dot" /></div>
      <div className="chat-list">
        {messages.length === 0 && <div className="chat-empty">Type anywhere. I remember everyone forever.</div>}
        {messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'chat-u' : 'chat-n'}>
            <div className="chat-role">{m.role === 'user' ? 'you' : 'noira'}</div>
            <div className="chat-text">{m.content}</div>
          </div>
        ))}
        {busy && <div className="chat-n"><div className="chat-role">noira</div><div className="chat-text chat-thinking">synapses firing…</div></div>}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send(); }}
          placeholder="Ask me anything — or tell me to build…" />
        <button onClick={send} disabled={busy}>→</button>
      </div>
    </div>
  );
}
