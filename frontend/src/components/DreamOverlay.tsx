import { useEffect, useRef } from 'react';

export interface DreamData {
  insights: string[];
  bestPath: number[];
  median: number;
  p90: number;
  p10: number;
  probSuccess: number;
}

// Fullscreen canvas: best-path revenue curve + particle futures + insights.
export function DreamOverlay({ dream, onClose }: { dream: DreamData; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const W = (cv.width = cv.offsetWidth * devicePixelRatio);
    const H = (cv.height = cv.offsetHeight * devicePixelRatio);

    // ghost futures (deterministic pseudo-random from median)
    const ghosts: { pts: number[]; alpha: number }[] = [];
    let seed = 42;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let g = 0; g < 40; g++) {
      const pts: number[] = [];
      let v = 0.08;
      for (let m = 0; m < 12; m++) { v = Math.max(0.02, v * (1 + (rnd() - 0.42) * 0.5)); pts.push(v); }
      ghosts.push({ pts, alpha: 0.05 + rnd() * 0.12 });
    }

    const t0 = performance.now();
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      const maxV = Math.max(...dream.bestPath, ...ghosts.flatMap(g => g.pts), 0.001);
      const X = (m: number) => (m / 11) * W * 0.86 + W * 0.07;
      const Y = (v: number) => H * 0.85 - (v / maxV) * H * 0.6;

      // ghosts
      for (const g of ghosts) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(107,45,255,${g.alpha})`;
        ctx.lineWidth = 1.5 * devicePixelRatio;
        g.pts.forEach((v, m) => { const x = X(m), y = Y(v); m ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
      }
      // best path (gold, animated draw)
      const prog = Math.min(1, t / 3);
      const n = Math.max(2, Math.floor(dream.bestPath.length * prog));
      ctx.beginPath();
      ctx.strokeStyle = '#D4A843';
      ctx.lineWidth = 3 * devicePixelRatio;
      ctx.shadowColor = '#D4A843';
      ctx.shadowBlur = 18;
      dream.bestPath.slice(0, n).forEach((v, m) => { const x = X(m), y = Y(v); m ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      ctx.shadowBlur = 0;
      // head pulse
      const last = dream.bestPath[n - 1];
      const hx = X(n - 1), hy = Y(last);
      const r = (6 + 3 * Math.sin(t * 4)) * devicePixelRatio;
      const grad = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 3);
      grad.addColorStop(0, 'rgba(212,168,67,.9)');
      grad.addColorStop(1, 'rgba(212,168,67,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(hx, hy, r * 3, 0, 7); ctx.fill();
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [dream]);

  const fmt = (c: number) => `${Math.round(c / 100).toLocaleString('es-ES')} €/mes`;

  return (
    <div className="dream-overlay">
      <div className="dream-head">
        <div>
          <div className="dream-kicker">CICLO DE SUEÑO · 300 FUTUROS SIMULADOS</div>
          <h2>Noira está soñando</h2>
        </div>
        <button className="dream-close" onClick={onClose}>despertar ↑</button>
      </div>
      <canvas ref={canvasRef} className="dream-canvas" />
      <div className="dream-stats">
        <div><span>mediana</span><b>{fmt(dream.median)}</b></div>
        <div><span>techo p90</span><b className="up">{fmt(dream.p90)}</b></div>
        <div><span>suelo p10</span><b className="down">{fmt(dream.p10)}</b></div>
        <div><span>P(×3 ingresos)</span><b>{(dream.probSuccess * 100).toFixed(1)}%</b></div>
      </div>
      <ul className="dream-insights">
        {dream.insights.map((s, i) => <li key={i}>{s}</li>)}
      </ul>
    </div>
  );
}
