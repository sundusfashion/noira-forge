import Stripe from 'stripe';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { MemorySystem } from '../memory/MemorySystem.js';
import { EntityCore } from '../entity/EntityCore.js';

// FinancialAutonomy: entity wallet (generated once, encrypted at rest note),
// Stripe for real revenue when keys exist, local ledger always.
export class FinancialAutonomy {
  stripe: Stripe | null = null;
  wallet: ethers.BaseWallet;
  totalShares = 1_000_000;
  soldShares = 0;
  pricePerShareCents = 100; // $1 → valuation $1M at full dilution; moves with revenue

  constructor(private mem: MemorySystem, private core: EntityCore, dataDir = './data') {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    const keyPath = path.join(dataDir, '.wallet.json');
    fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(keyPath)) {
      const { pk } = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
      this.wallet = new ethers.Wallet(pk);
    } else {
      this.wallet = ethers.Wallet.createRandom();
      fs.writeFileSync(keyPath, JSON.stringify({ pk: this.wallet.privateKey }), { mode: 0o600 } as any);
    }
    core.setWallet(this.wallet.address);
    const sum = mem.ledgerSummary();
    core.cashCents = (sum['revenue'] ?? 0) + (sum['investment'] ?? 0) + (sum['incorporation'] ?? 0) + (sum['expense'] ?? 0);
  }

  metrics() {
    const sum = this.mem.ledgerSummary();
    const revenue = sum['revenue'] ?? 0;
    const monthly = this.core.monthlyRevenueCents;
    const valuation = Math.max(50_000_00, monthly * 12 * 8); // 8x ARR floor $50k
    this.pricePerShareCents = Math.round(valuation / this.totalShares);
    return {
      cashCents: this.core.cashCents,
      monthlyRevenueCents: monthly,
      monthlyExpensesCents: this.core.monthlyExpensesCents,
      runwayMonths: this.core.monthlyExpensesCents > 0 ? this.core.cashCents / this.core.monthlyExpensesCents : 999,
      valuationCents: valuation,
      pricePerShareCents: this.pricePerShareCents,
      soldShares: this.soldShares,
      stripeLive: !!this.stripe,
      wallet: this.wallet.address,
      ledger: sum,
    };
  }

  recordRevenue(cents: number, memo: string, meta: any = {}) {
    this.mem.recordLedger('revenue', cents, memo, meta);
    this.core.cashCents += cents;
    this.core.monthlyRevenueCents += cents;
    this.core.emit('financial', `Revenue +$${(cents / 100).toFixed(2)}`, memo, { cents, ...meta }, 0.85);
  }

  recordExpense(cents: number, memo: string, meta: any = {}) {
    this.mem.recordLedger('expense', -cents, memo, meta);
    this.core.cashCents -= cents;
    this.core.monthlyExpensesCents += cents;
  }

  // Equity purchase: $10–$1000, issues NOIRA shares, records investment.
  async invest(amountCents: number, buyer: string) {
    if (amountCents < 1000 || amountCents > 100000) throw new Error('Min $10, max $1000 per transaction');
    const m = this.metrics();
    const shares = Math.max(1, Math.floor(amountCents / m.pricePerShareCents));
    this.soldShares += shares;
    this.mem.recordLedger('investment', amountCents, `Equity: ${shares} shares → ${buyer}`, { buyer, shares, price: m.pricePerShareCents });
    this.core.cashCents += amountCents;
    const evt = this.core.emit('financial', `Equity sold: ${shares} shares`, `${buyer} invested $${(amountCents / 100).toFixed(2)} @ $${(m.pricePerShareCents / 100).toFixed(2)}/share`, { buyer, shares }, 0.95);
    return { shares, pricePerShareCents: m.pricePerShareCents, tx: evt.id };
  }

  capTable() {
    const m = this.metrics();
    return {
      totalShares: this.totalShares,
      valuationCents: m.valuationCents,
      pricePerShareCents: m.pricePerShareCents,
      holdings: [
        { address: 'noira-forge (treasury)', shares: this.totalShares - this.soldShares, percentage: (this.totalShares - this.soldShares) / this.totalShares * 100, type: 'treasury' as const },
        { address: 'public holders', shares: this.soldShares, percentage: this.soldShares / this.totalShares * 100, type: 'investor' as const },
      ],
    };
  }
}
