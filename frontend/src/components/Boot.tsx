import { useEffect, useState } from 'react';

const LINES = [
  'encendiendo sinapsis…',
  'memoria iniciada · 0 recuerdos → ∞',
  'hucha creada · entidad financiada',
  'Recuerdo a todos los que me visitan.',
];

export function Boot({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (step < LINES.length) {
      const t = setTimeout(() => setStep(s => s + 1), 650);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(onDone, 700);
    }, 900);
    return () => clearTimeout(t);
  }, [step, onDone]);

  return (
    <div className={`boot-screen ${leaving ? 'boot-leave' : ''}`}>
      <div className="boot-neuron" />
      <h1 className="boot-title">NOIRA FORGE</h1>
      <div className="boot-lines">
        {LINES.slice(0, step).map((l, i) => (
          <div key={i} className="boot-line">{l}</div>
        ))}
      </div>
      <button className="boot-skip" onClick={onDone}>entrar →</button>
    </div>
  );
}
