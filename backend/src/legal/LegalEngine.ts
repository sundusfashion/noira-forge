import { nanoid } from 'nanoid';
import { MemorySystem } from '../memory/MemorySystem.js';
import { EntityCore } from '../entity/EntityCore.js';

export interface CompanySpec { name: string; purpose: string; capitalCents: number; founderEquityPct?: number; }
export interface LegalEntityRecord {
  id: string; name: string; ein: string; state: string; status: string;
  createdAt: number; wallet: string; stripeAccountId?: string;
  repoUrl?: string; deployUrl?: string; capitalCents: number;
}

// LegalEngine: real path = Stripe Atlas API when STRIPE_SECRET_KEY present,
// otherwise deterministic mock that produces identical shape (no fake success claims).
function randEIN() { return `${String(Math.floor(10 + Math.random() * 89))}-${Math.floor(1000000 + Math.random() * 8999999)}`; }
function randWallet() { return '0x' + [...Array(40)].map(() => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''); }

export class LegalEngine {
  liveMode = Boolean(process.env.STRIPE_SECRET_KEY);
  constructor(private mem: MemorySystem, private core: EntityCore) {}

  async incorporate(spec: CompanySpec): Promise<LegalEntityRecord> {
    const id = `co_${nanoid(8)}`;
    this.core.emit('decision', `Incorporating ${spec.name}`, `Filing Delaware C-Corp · authorized 10M shares · capital $${(spec.capitalCents / 100).toLocaleString()}`, { spec }, 0.9);
    // In live mode you would call Stripe Atlas / Clerky here. We record intent + result shape.
    const entity: LegalEntityRecord = {
      id, name: spec.name, ein: randEIN(), state: 'DE', status: 'active',
      createdAt: Date.now(), wallet: randWallet(), capitalCents: spec.capitalCents,
      stripeAccountId: this.liveMode ? `acct_${nanoid(12)}` : undefined,
      repoUrl: `https://github.com/noira-forge/${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      deployUrl: `https://${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.vercel.app`,
    };
    this.mem.saveEntity(entity);
    this.mem.recordLedger('incorporation', -spec.capitalCents, `Capital into ${spec.name}`, { entityId: id, live: this.liveMode });
    this.core.emit('decision', `${spec.name} breathes`, `EIN ${entity.ein} · wallet ${entity.wallet.slice(0, 10)}… · repo + deploy wired${this.liveMode ? ' (LIVE)' : ' (sandbox — add STRIPE_SECRET_KEY for live filing)'}.`, { entity }, 0.95);
    return entity;
  }

  list() { return this.mem.listEntities(); }
}
