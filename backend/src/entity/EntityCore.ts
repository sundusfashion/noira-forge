import { MemorySystem, MemoryEvent } from '../memory/MemorySystem.js';
import { nanoid } from 'nanoid';

export type EntityMode = 'awake' | 'dreaming' | 'deciding';

export interface NeuronState {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision';
  position: [number, number, number];
  activation: number;
  connections: string[];
  metadata: { title: string; content: string; timestamp: number; importance: number; type: string };
}

export interface Genome {
  riskTolerance: number;
  revenueWeight: number;
  growthWeight: number;
  hiringThreshold: number;
  simulationIterations: number;
  dreamFrequency: number;
  investmentStrategy: 'conservative' | 'balanced' | 'aggressive';
}

// Spreading-activation cortex: neurons on a sphere, activation decays, thoughts propagate.
export class EntityCore {
  name = 'Noira Forge';
  birthTimestamp = Date.now();
  version = '0.1.0';
  mode: EntityMode = 'awake';
  neurons = new Map<string, NeuronState>();
  genome: Genome = {
    riskTolerance: 0.5, revenueWeight: 0.6, growthWeight: 0.4,
    hiringThreshold: 0.55, simulationIterations: 300,
    dreamFrequency: 21600, investmentStrategy: 'balanced',
  };
  generation = 1;
  wallet = '';
  cashCents = 0;
  monthlyRevenueCents = 0;
  monthlyExpensesCents = 0;

  private listeners = new Set<(evt: MemoryEvent) => void>();
  private dreamTimer: any = null;

  constructor(public memory: MemorySystem) {
    this.seedCortex(600);
    // birth memory
    if (memory.count() === 0) {
      memory.store({
        type: 'decision', title: 'Noira Forge awakens',
        content: 'I am Noira Forge. I remember everyone who visits me. I incorporate companies, hold capital, dream futures, and evolve.',
        metadata: { role: 'noira', birth: true }, importance: 1.0,
      });
    }
  }

  onEvent(fn: (evt: MemoryEvent) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  emit(type: MemoryEvent['type'], title: string, content: string, metadata: any = {}, importance = 0.6): MemoryEvent {
    const evt = this.memory.store({ type, title, content, metadata, importance });
    // create / activate neuron
    const n = this.neuronFor(evt);
    n.activation = Math.min(1, 0.4 + importance * 0.6);
    this.propagate(n.id, 2);
    for (const fn of this.listeners) { try { fn(evt); } catch {} }
    return evt;
  }

  private seedCortex(n: number) {
    for (let i = 0; i < n; i++) {
      const id = `n_${i}`;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 18 + Math.random() * 14;
      const types: NeuronState['type'][] = ['episodic', 'semantic', 'procedural', 'dream', 'decision'];
      const type = types[i % types.length];
      this.neurons.set(id, {
        id, type,
        position: [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)],
        activation: Math.random() * 0.3,
        connections: [],
        metadata: { title: '', content: '', timestamp: Date.now(), importance: 0.3, type },
      });
    }
    // wire k-nearest (cheap: random links, small-world)
    const ids = [...this.neurons.keys()];
    for (const id of ids) {
      const n = this.neurons.get(id)!;
      for (let k = 0; k < 3; k++) {
        const other = ids[Math.floor(Math.random() * ids.length)];
        if (other !== id) n.connections.push(other);
      }
    }
  }

  private neuronFor(evt: MemoryEvent): NeuronState {
    if (evt.neuronId && this.neurons.has(evt.neuronId)) return this.neurons.get(evt.neuronId)!;
    // pick least-active neuron of matching family and repurpose
    const family = evt.type === 'dream' ? 'dream' : evt.type === 'decision' ? 'decision' : evt.type === 'financial' ? 'procedural' : 'episodic';
    let best: NeuronState | null = null;
    for (const n of this.neurons.values()) {
      if (n.type !== family) continue;
      if (!best || n.activation < best.activation) best = n;
    }
    const target = best ?? [...this.neurons.values()][0];
    target.metadata = { title: evt.title, content: evt.content.slice(0, 280), timestamp: evt.timestamp, importance: evt.importance, type: evt.type };
    return target;
  }

  private propagate(fromId: string, depth: number) {
    if (depth <= 0) return;
    const n = this.neurons.get(fromId);
    if (!n) return;
    for (const cid of n.connections.slice(0, 4)) {
      const c = this.neurons.get(cid);
      if (!c) continue;
      c.activation = Math.min(1, c.activation + 0.25 / depth);
      this.propagate(cid, depth - 1);
    }
  }

  tick() {
    // metabolic decay
    for (const n of this.neurons.values()) n.activation = Math.max(0.02, n.activation * 0.985);
    // background thought: random neuron fires
    const ids = [...this.neurons.keys()];
    const pick = this.neurons.get(ids[Math.floor(Math.random() * ids.length)]);
    if (pick) pick.activation = Math.min(1, pick.activation + 0.3);
    return this.snapshot();
  }

  snapshot() {
    return {
      name: this.name, version: this.version, birthTimestamp: this.birthTimestamp,
      mode: this.mode, generation: this.generation, genome: this.genome,
      neurons: [...this.neurons.values()].slice(0, 1200), // cap payload; client renders subset
      neuronCount: this.neurons.size,
      wallet: this.wallet, cashCents: this.cashCents,
      monthlyRevenueCents: this.monthlyRevenueCents, monthlyExpensesCents: this.monthlyExpensesCents,
    };
  }

  // Dream = Monte Carlo futures over current portfolio. Returns insights + mutates genome.
  async dream(iterations = 300): Promise<any> {
    this.mode = 'dreaming';
    this.emit('dream', 'Dream cycle begins', `Simulating ${iterations} futures across portfolio. Cortex shifts to melancholy.`, {}, 0.85);
    const futures: any[] = [];
    for (let i = 0; i < iterations; i++) {
      const growth = (Math.random() - 0.35) * (0.5 + this.genome.riskTolerance);
      const months: number[] = [];
      let rev = this.monthlyRevenueCents || 5000;
      for (let m = 0; m < 12; m++) { rev = Math.max(0, rev * (1 + growth * (0.5 + Math.random()))); months.push(Math.round(rev)); }
      futures.push({ finalRevenue: months[11], months });
    }
    futures.sort((a, b) => b.finalRevenue - a.finalRevenue);
    const p90 = futures[Math.floor(iterations * 0.1)]?.finalRevenue ?? 0;
    const median = futures[Math.floor(iterations * 0.5)]?.finalRevenue ?? 0;
    const p10 = futures[Math.floor(iterations * 0.9)]?.finalRevenue ?? 0;
    const probSuccess = futures.filter(f => f.finalRevenue > (this.monthlyRevenueCents || 5000) * 3).length / iterations;
    const insights = [
      `Median 12-mo revenue: $${Math.round(median / 100).toLocaleString()}/mo`,
      `Upside (p90): $${Math.round(p90 / 100).toLocaleString()}/mo, Downside (p10): $${Math.round(p10 / 100).toLocaleString()}/mo`,
      `P(3x revenue in 12mo) = ${(probSuccess * 100).toFixed(1)}% at risk=${this.genome.riskTolerance.toFixed(2)}`,
    ];
    if (probSuccess < 0.25 && this.genome.riskTolerance < 0.8) {
      this.genome.riskTolerance = Math.min(0.9, this.genome.riskTolerance + 0.07);
      insights.push(`Mutation: risk_tolerance → ${this.genome.riskTolerance.toFixed(2)} (evolution gen ${++this.generation})`);
      this.emit('evolution', 'Genome mutated', insights[insights.length - 1], { genome: this.genome }, 0.9);
    }
    this.emit('dream', 'Dream cycle complete', insights.join(' · '), { p90, median, p10, probSuccess }, 0.9);
    this.mode = 'awake';
    return { iterations, p90, median, p10, probSuccess, insights, bestPath: futures[0]?.months ?? [] };
  }

  setWallet(addr: string) { this.wallet = addr; }
}
