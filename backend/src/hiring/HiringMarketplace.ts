import { nanoid } from 'nanoid';
import { MemorySystem } from '../memory/MemorySystem.js';
import { EntityCore } from '../entity/EntityCore.js';
import { FinancialAutonomy } from '../financial/FinancialAutonomy.js';

export interface JobPosting { id: string; role: string; companyId: string; budgetCents: number; prompt: string; status: string; createdAt: number; }

// HiringMarketplace: Noira posts jobs, executes them via Groq (or local fallback),
// pays from treasury ledger. Every hire is a real LLM call with budget accounting.
export class HiringMarketplace {
  jobs: JobPosting[] = [];
  constructor(private mem: MemorySystem, private core: EntityCore, private fin: FinancialAutonomy) {}

  async postAndExecute(role: string, prompt: string, budgetCents: number, companyId = 'noira-forge'): Promise<any> {
    const job: JobPosting = { id: `job_${nanoid(6)}`, role, companyId, budgetCents, prompt, status: 'open', createdAt: Date.now() };
    this.jobs.push(job);
    this.core.emit('hired', `Job posted: ${role}`, prompt.slice(0, 160), { job }, 0.7);

    const output = await this.executeWithLLM(prompt);
    const costCents = Math.min(budgetCents, 25); // ~$0.25 cap per task on free tier
    this.fin.recordExpense(costCents, `AI hire (${role}): ${job.id}`, { jobId: job.id });
    job.status = 'done';
    const evt = this.core.emit('hired', `Contractor ${role} delivered`, String(output).slice(0, 500), { jobId: job.id, output: String(output).slice(0, 2000) }, 0.85);
    return { job, output, costCents, eventId: evt.id };
  }

  // Model chain: env override first, then Groq's current flagships.
  // (llama-3.3-70b-versatile was retired by Groq on 2026-08-16 — the chain survives the next retirement too.)
  private models(): string[] {
    return [process.env.GROQ_MODEL, 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.6-27b']
      .filter((m): m is string => !!m && m.length > 0);
  }

  private async executeWithLLM(prompt: string): Promise<string> {
    const key = process.env.GROQ_API_KEY;
    if (!key) {
      // Honest offline fallback: template-based worker (no fake "GPT did it")
      return `[offline-worker] No GROQ_API_KEY set. Task queued with deterministic plan:\n1) ${prompt.slice(0, 120)}\n2) Break into 3 subtasks, execute cheapest-first.\n3) Report metrics. Add GROQ_API_KEY for live LLM execution.`;
    }
    const { default: Groq } = await import('groq-sdk');
    const groq = new Groq({ apiKey: key });
    let lastErr = '';
    for (const model of this.models()) {
      try {
        const r = await groq.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: 'You are a contractor hired by Noira Forge, an autonomous digital entity. Be concise, technical, and produce shippable output. No fluff.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.6, max_tokens: 1500,
        });
        const out = r.choices[0]?.message?.content;
        if (out) return out;
        lastErr = 'empty response';
      } catch (e: any) {
        lastErr = e.message || String(e);
        // retired/unknown model → try next in chain; anything else → stop, report
        if (/does not exist|invalid_request|model_not_found|404/i.test(lastErr)) continue;
        break;
      }
    }
    return `[llm-error] ${lastErr}`;
  }
}
