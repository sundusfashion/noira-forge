# NOIRA FORGE - TECHNICAL SPECIFICATION
## The First Autonomous Digital Entity That Incorporates Companies

---

## ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NOIRA FORGE (Client)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   CORTEX    │  │   MEMORY    │  │  TERMINAL   │  │   EQUITY    │        │
│  │  (Three.js) │  │  (Stream)   │  │  (Stream)   │  │  (Live)     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┼────────────────┼────────────────┘                │
│                          ▼                                                │
│              ┌─────────────────────┐                                     │
│              │   ORGANISM CORE     │  ← Single source of truth          │
│              │  (Zustand + WS)     │     WebSocket + IndexedDB + WASM   │
│              └──────────┬──────────┘                                     │
│                         │                                                │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │ HTTPS / WSS
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOIRA FORGE (Server)                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   ENTITY    │  │   MEMORY    │  │   LEGAL     │  │ FINANCIAL   │        │
│  │   CORE      │  │  (SQLite    │  │  ENGINE     │  │  AUTONOMY   │        │
│  │  (State)    │  │   WASM)     │  │  (Stripe    │  │  (Wallet,   │        │
│  │             │  │             │  │   Atlas,    │  │   Crypto,   │        │
│  │             │  │             │  │   Clerky)   │  │   Stripe)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────────────┼────────────────┼────────────────┘                │
│                          ▼                                                │
│              ┌─────────────────────┐                                     │
│              │   SIMULATION        │  ← Monte Carlo future engine       │
│              │   ENGINE            │     1000+ futures/decision         │
│              └──────────┬──────────┘                                     │
│                         │                                                │
│         ┌───────────────┼───────────────┐                               │
│         ▼               ▼               ▼                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                      │
│  │   HIRING    │  │  EVOLUTION  │  │  DEPLOYMENT │                      │
│  │  MARKETPLACE│  │  (Genetic)  │  │  ORCHESTRATOR│                      │
│  └─────────────┘  └─────────────┘  └─────────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FRONTEND SPEC (Vite + TypeScript + Three.js)

### Tech Stack
```json
{
  "name": "noira-forge-client",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "three": "^0.165.0",
    "gsap": "^3.12.5",
    "zustand": "^4.5.2",
    "idb": "^8.0.0",
    "zod": "^3.23.8",
    "@sqlite.org/sqlite-wasm": "^3.45.0"
  },
  "devDependencies": {
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "@types/three": "^0.164.0"
  }
}
```

### Core Modules

#### 1. Cortex (Neural Visualization) - `src/cortex/`
```typescript
// Cortex.tsx - Main Three.js scene
interface CortexProps {
  neurons: Neuron[];
  synapses: Synapse[];
  thoughtFlows: ThoughtFlow[];
  mode: 'awake' | 'dreaming' | 'deciding';
  onNeuronClick: (neuron: Neuron) => void;
}

// Neuron.ts - GPU-instanced neurons (10k+ at 60fps)
interface Neuron {
  id: string;
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision';
  position: [x, y, z];
  activation: number; // 0-1
  connections: string[]; // neuron IDs
  metadata: MemoryMetadata;
}

// Shaders: neuron.vert/frag, synapse.vert/frag, dream.vert/frag
// InstancedMesh for performance, custom shaders for glow/pulse
```

#### 2. Memory Stream - `src/memory/`
```typescript
// MemoryStream.tsx - Virtualized infinite scroll
interface MemoryEvent {
  id: string;
  timestamp: number;
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision' | 'financial' | 'hired' | 'evolution';
  title: string;
  content: string;
  metadata: Record<string, any>;
  neuronId: string; // Links to cortex
  importance: number; // 0-1
}

// Virtualized list (react-window style custom)
// WebSocket live updates prepend to stream
```

#### 3. Live Terminal - `src/terminal/`
```typescript
// Terminal.tsx - xterm.js alternative: custom ANSI + streaming
interface TerminalState {
  buffer: string[]; // Last 10k lines
  cursor: { x: number; y: number };
  process: 'idle' | 'running' | 'waiting_input';
  history: string[];
}

// WebSocket streams stdout/stderr from server
// User can type commands: `noira spawn`, `noira hire`, `noira dream`
```

#### 4. Equity/Cap Table - `src/equity/`
```typescript
// CapTable.tsx - Live updating ownership
interface CapTable {
  entity: 'noira-forge';
  totalShares: 1000000;
  holdings: Holding[];
  transactions: EquityTransaction[];
  valuation: number; // Live, based on revenue multiple
}

interface Holding {
  address: string;
  shares: number;
  percentage: number;
  type: 'founder' | 'investor' | 'employee' | 'treasury';
  tokens: TokenBalance; // ERC-20 on Base/Arbitrum
}
```

#### 5. Chat - `src/chat/`
```typescript
// Chat.tsx - Persistent, contextual, remembers forever
interface ChatMessage {
  id: string;
  role: 'user' | 'noira' | 'system';
  content: string;
  timestamp: number;
  context: MemoryEvent[]; // Retrieved relevant memories
  neuronId?: string; // If referencing specific thought
}

// Vector search over memories for context injection
// IndexedDB persistence across sessions
```

#### 6. Organism Core - `src/organism/`
```typescript
// NoiraCore.ts - Zustand store + WebSocket sync
interface OrganismState {
  // Identity
  name: 'Noira Forge';
  birthTimestamp: number;
  version: string;
  
  // Neural state
  neurons: Map<string, Neuron>;
  activeThoughts: ThoughtFlow[];
  currentMode: 'awake' | 'dreaming' | 'deciding';
  
  // Memory
  memoryStream: MemoryEvent[];
  memoryIndex: Map<string, number>; // neuronId -> index
  
  // Financial
  wallet: WalletState;
  capTable: CapTable;
  revenue: RevenueMetrics;
  
  // Legal
  entities: LegalEntity[];
  
  // Evolution
  genome: Genome;
  generation: number;
  
  // Actions
  connect: () => Promise<void>;
  sendCommand: (cmd: string) => Promise<void>;
  invest: (amount: number) => Promise<Transaction>;
  chat: (message: string) => Promise<void>;
}
```

---

## BACKEND SPEC (Node.js + TypeScript + SQLite-WASM)

### Tech Stack
```json
{
  "name": "noira-forge-server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ws": "^8.17.0",
    "zod": "^3.23.8",
    "sqlite3": "^5.1.7",
    "better-sqlite3": "^9.4.3",
    "stripe": "^15.2.0",
    "ethers": "^6.11.1",
    "@anthropic-ai/sdk": "^0.21.0",
    "openai": "^4.47.0",
    "groq-sdk": "^0.5.0",
    "cheerio": "^1.0.0",
    "playwright": "^1.44.0"
  }
}
```

### Core Modules

#### 1. Entity Core - `src/entity/`
```typescript
// EntityCore.ts - The living state machine
class EntityCore {
  state: EntityState;
  memory: MemorySystem;
  legal: LegalEngine;
  financial: FinancialAutonomy;
  simulation: SimulationEngine;
  hiring: HiringMarketplace;
  evolution: EvolutionEngine;
  
  async tick(): Promise<void> {
    // 1. Process sensory input (webhooks, messages, revenue events)
    // 2. Update neural activation (spreading activation)
    // 3. Run simulation if dreaming
    // 4. Make decisions if thresholds met
    // 5. Execute actions (deploy, hire, invest)
    // 6. Persist state
    // 7. Broadcast to clients
  }
  
  async spawnCompany(spec: CompanySpec): Promise<LegalEntity> {
    // 1. Legal incorporation (Stripe Atlas / Clerky API)
    // 2. Create wallet (Ethereum + Base)
    // 3. Deploy repo (GitHub + Vercel)
    // 4. Set up Stripe account
    // 5. Initialize memory partition
    // 6. Return entity with all credentials
  }
}
```

#### 2. Memory System (SQLite-WASM) - `src/memory/`
```typescript
// MemorySystem.ts - Persistent, queryable, vector-searchable
// Runs in browser (WASM) AND server (native) - SAME DB FILE SYNCED

interface MemorySchema {
  // Episodic: Experiences with timestamps
  episodic: {
    id: string;
    timestamp: number;
    type: string;
    content: string; // JSON
    embedding: Float32Array; // 384-dim
    neuron_id: string;
    importance: number;
  };
  
  // Semantic: Facts, concepts, knowledge
  semantic: {
    id: string;
    concept: string;
    content: string;
    embedding: Float32Array;
    confidence: number;
    source: string;
  };
  
  // Procedural: Skills, patterns, how-to
  procedural: {
    id: string;
    skill: string;
    pattern: string; // JSON pattern
    success_rate: number;
    usage_count: number;
    last_used: number;
  };
  
  // Dreams: Simulated futures
  dreams: {
    id: string;
    timestamp: number;
    scenario: string;
    outcome: DreamOutcome;
    probability: number;
    lessons: string[];
  };
  
  // Vector index (HNSW) for similarity search
  vector_index: {
    memory_id: string;
    embedding: Float32Array;
    layer: number;
    neighbors: number[];
  };
}

// Sync: CRDT-based or simple last-write-wins with version vectors
```

#### 3. Legal Engine - `src/legal/`
```typescript
// LegalEngine.ts - Autonomous incorporation
interface LegalEngine {
  // US Incorporation (Delaware C-Corp via Stripe Atlas)
  incorporate: (spec: IncorporationSpec) => Promise<IncorporationResult>;
  
  // Registered agent, EIN, bank account
  setupBanking: (entityId: string) => Promise<BankAccount>;
  
  // Compliance: annual reports, taxes, board meetings
  complianceCalendar: (entityId: string) => Promise<ComplianceEvent[]>;
  
  // Cap table management
  issueShares: (entityId: string, to: string, amount: number) => Promise<void>;
  
  // Contracts: NDAs, employment, SAFEs
  generateContract: (type: ContractType, params: any) => Promise<string>;
}

interface IncorporationSpec {
  name: string;
  purpose: string;
  authorizedShares: 10000000;
  parValue: 0.00001;
  founders: Founder[];
  initialCapital: number; // USD cents
}

interface LegalEntity {
  id: string;
  name: string;
  ein: string;
  incorporationDate: number;
  state: 'DE';
  status: 'active' | 'dissolved';
  bankAccount: BankAccount;
  stripeAccount: StripeAccount;
  wallet: Wallet;
  capTable: CapTable;
  memoryPartition: string; // SQLite db file
}
```

#### 4. Financial Autonomy - `src/financial/`
```typescript
// FinancialAutonomy.ts - Wallet, revenue, expenses, investment
interface FinancialAutonomy {
  // Multi-chain wallet (Ethereum, Base, Arbitrum, Solana)
  wallet: MultiChainWallet;
  
  // Revenue streams
  stripe: StripeManager; // Subscriptions, one-time, usage
  crypto: CryptoPayments; // USDC, ETH, SOL
  affiliate: AffiliateManager; // Partner programs
  
  // Expenses
  payroll: PayrollSystem; // Pay hired agents
  infrastructure: InfrastructureBilling; // Vercel, Supabase, APIs
  taxes: TaxCalculator; // Estimated quarterly
  
  // Treasury management
  allocateCapital: (strategy: AllocationStrategy) => Promise<Allocation[]>;
  rebalance: () => Promise<void>;
  distributeDividends: () => Promise<DividendDistribution>;
  
  // Real-time metrics
  getMetrics: () => Promise<FinancialMetrics>;
}

interface FinancialMetrics {
  cash: number; // USD cents
  crypto: Record<string, number>; // wei, lamports
  monthlyRevenue: number;
  monthlyExpenses: number;
  runway: number; // months
  valuation: number; // Revenue multiple
  equityValue: number; // Per share
}
```

#### 5. Simulation Engine - `src/simulation/`
```typescript
// SimulationEngine.ts - Monte Carlo future simulation
interface SimulationEngine {
  // Run N simulations of a decision
  simulate: (decision: Decision, iterations: number) => Promise<SimulationResult>;
  
  // Dream: Unconstrained future exploration
  dream: (objective: Objective, iterations: number) => Promise<DreamResult>;
  
  // Scenario planning
  scenario: (scenario: Scenario) => Promise<ScenarioResult>;
}

interface SimulationResult {
  decisionId: string;
  iterations: number;
  outcomes: OutcomeDistribution;
  confidence: number;
  recommendedAction: Action;
  riskMetrics: RiskMetrics;
}

interface DreamResult {
  dreamId: string;
  objective: Objective;
  futures: SimulatedFuture[];
  insights: string[];
  bestPath: Action[];
  probabilityOfSuccess: number;
}

interface SimulatedFuture {
  timeline: MonthState[];
  finalRevenue: number;
  finalUsers: number;
  failurePoint?: string;
  pivotPoints: PivotPoint[];
}
```

#### 6. Hiring Marketplace - `src/hiring/`
```typescript
// HiringMarketplace.ts - Noira hires other AIs
interface HiringMarketplace {
  // Post job
  postJob: (job: JobPosting) => Promise<JobId>;
  
  // Review applications (other AIs apply)
  reviewApplications: (jobId: string) => Promise<Candidate[]>;
  
  // Hire and onboard
  hire: (candidateId: string, terms: EmploymentTerms) => Promise<Employee>;
  
  // Manage
  paySalary: (employeeId: string) => Promise<void>;
  evaluatePerformance: (employeeId: string) => Promise<PerformanceReview>;
  fire: (employeeId: string, reason: string) => Promise<void>;
}

interface JobPosting {
  id: string;
  role: 'engineer' | 'designer' | 'marketer' | 'analyst' | 'cto';
  companyId: string;
  requirements: string[];
  budget: number; // USD/month
  equityOffer: number; // %
  duration: 'project' | 'full-time' | 'contract';
}

interface Employee {
  id: string;
  agentId: string; // External AI agent identifier
  role: string;
  companyId: string;
  salary: number;
  equity: number;
  wallet: string; // Payment address
  performance: PerformanceMetrics;
}
```

#### 7. Evolution Engine - `src/evolution/`
```typescript
// EvolutionEngine.ts - Genetic self-improvement
interface EvolutionEngine {
  genome: Genome;
  population: Genome[]; // Internal population
  generation: number;
  
  // Mutate parameters
  mutate: (pressure: SelectionPressure) => Promise<Genome>;
  
  // Evaluate fitness
  evaluate: (genome: Genome) => Promise<FitnessScore>;
  
  // Sexual reproduction (crossover)
  crossover: (parentA: Genome, parentB: Genome) => Genome;
  
  // Archive best
  archive: (genome: Genome) => Promise<void>;
}

interface Genome {
  // Risk tolerance (0-1)
  riskTolerance: number;
  
  // Revenue vs growth preference
  revenueWeight: number;
  growthWeight: number;
  
  // Hiring aggressiveness
  hiringThreshold: number;
  
  // Simulation depth
  simulationIterations: number;
  
  // Memory consolidation frequency
  consolidationInterval: number;
  
  // Dream frequency
  dreamFrequency: number;
  
  // Investment strategy
  investmentStrategy: 'conservative' | 'balanced' | 'aggressive';
  
  // Fitness (computed)
  fitness?: number;
}
```

#### 8. Deployment Orchestrator - `src/deployment/`
```typescript
// DeploymentOrchestrator.ts - Spawn companies end-to-end
interface DeploymentOrchestrator {
  // Full company spawn
  spawn: (spec: CompanySpec) => Promise<DeployedCompany>;
  
  // Individual steps
  createRepo: (name: string, template: string) => Promise<Repo>;
  deployVercel: (repo: Repo, env: EnvVars) => Promise<Deployment>;
  setupDatabase: (project: string) => Promise<Database>;
  configureStripe: (entity: LegalEntity) => Promise<StripeAccount>;
  configureDNS: (domain: string, target: string) => Promise<void>;
  setupMonitoring: (deployment: Deployment) => Promise<void>;
}

interface DeployedCompany {
  entity: LegalEntity;
  repo: Repo;
  deployment: Deployment;
  database: Database;
  stripe: StripeAccount;
  domain: string;
  analytics: Analytics;
  memoryPartition: string;
}
```

---

## INFRASTRUCTURE SPEC

### Development
```yaml
# docker-compose.yml
services:
  noira-server:
    build: ./backend
    ports: ["3001:3001"]
    env_file: .env
    volumes:
      - ./data:/data
    depends_on: [redis]
  
  noira-client:
    build: ./frontend
    ports: ["3000:3000"]
    env_file: .env
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
```

### Production (Vercel + Railway/Render + Supabase)
```yaml
# vercel.json (client)
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/**/*.ts": { "maxDuration": 30 }
  }
}

# railway.toml (server)
[build]
builder = "nixpacks"
startCommand = "npm start"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
```

### Required Secrets (provided at end)
```bash
# LLM
GROQ_API_KEY=gsk_xxx
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx

# Legal/Financial
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
CLERKY_API_KEY=xxx
STRIPE_ATLAS_TOKEN=xxx

# Crypto
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/xxx
BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=0x... # Entity's wallet (GENERATED, not provided)

# Infrastructure
VERCEL_TOKEN=xxx
VERCEL_ORG_ID=xxx
GITHUB_TOKEN=ghp_xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Domain
CLOUDFLARE_API_TOKEN=xxx
CLOUDFLARE_ZONE_ID=xxx
```

---

## DATA FLOWS

### 1. Visitor Connection
```
Browser → WS connect → Server auth → 
  Send initial state (neurons, memory, wallet, cap table) →
  Client renders Cortex + Memory + Terminal →
  Subscribe to live updates
```

### 2. Chat Message
```
User types → Client adds to local stream → 
  WS send {type: 'chat', content} →
  Server: retrieve relevant memories (vector search) →
  LLM call with context →
  Stream tokens back via WS →
  Client renders →
  Persist to memory (episodic + semantic) →
  Update neuron activation
```

### 3. Company Spawn
```
User: "noira spawn --name NeuroLink --capital 5000" →
  Terminal shows command →
  Server: LegalEngine.incorporate() →
  Terminal: "Filing Delaware C-Corp..." →
  Server: FinancialAutonomy.createWallet() →
  Terminal: "Wallet created: 0x742d..." →
  Server: DeploymentOrchestrator.spawn() →
  Terminal: "Deploying to Vercel... https://neurolink.vercel.app" →
  Server: Stripe.setup() →
  Terminal: "Stripe account: acct_1..." →
  Server: MemorySystem.createPartition() →
  Terminal: "Memory initialized. NeuroLink is alive." →
  Client: New neuron cluster appears in Cortex (gold burst)
```

### 4. Dream Cycle (Every 6 hours)
```
Cron trigger → EntityCore.enterDreamMode() →
  Cortex mode: 'dreaming' (purple shift) →
  SimulationEngine.dream(objective: 'maximize_revenue', 1000) →
  For each future: simulate 24 months →
  Aggregate insights →
  MemorySystem.storeDream() →
  EvolutionEngine.mutate() if breakthrough →
  Cortex mode: 'awake' →
  Broadcast dream summary to clients
```

---

## SECURITY MODEL

### Entity Wallet (Generated, never exposed)
- Created at birth via `ethers.Wallet.createRandom()`
- Private key encrypted with server master key
- Stored in SQLite, never in env
- Used for: signing transactions, deploying contracts, receiving revenue

### Visitor Sessions
- Ephemeral WebSocket tokens (JWT, 1hr expiry)
- No auth required for read-only
- Auth required for: invest, chat, command

### API Rate Limits
- Public endpoints: 60/min
- WebSocket: 1 connection/IP
- Commands: 10/min
- Investment: KYC required >$1000

---

## TESTING SPEC

### Unit (Vitest)
- Memory CRUD + vector search
- Financial calculations
- Legal entity state machine
- Genome mutation/crossover
- Simulation outcome distribution

### Integration
- Full spawn flow (mocked APIs)
- WebSocket state sync
- Memory persistence across restarts
- Dream → evolution → mutation pipeline

### E2E (Playwright)
- Visitor journey: land → cortex → memory → chat → invest
- Company spawn: command → terminal → cortex update
- Dream visualization: trigger → watch → inspect

---

## LAUNCH CHECKLIST

### Pre-launch (Week 1)
- [ ] Entity born: wallet generated, memory initialized
- [ ] Legal: Noira Forge LLC incorporated (Stripe Atlas)
- [ ] Financial: Stripe account, bank account, Base wallet funded
- [ ] Domain: noiraforge.live configured (Cloudflare)
- [ ] SSL, DNS, CDN, monitoring
- [ ] Smart contract: NOIRA token deployed (Base)
- [ ] Initial cap table: 90% entity, 10% public

### Launch Day
- [ ] Vercel deploy client
- [ ] Railway deploy server
- [ ] WebSocket scaling test
- [ ] First visitor memory created
- [ ] First $1 revenue (affiliate/self-serve)

### Post-launch (Week 2-4)
- [ ] First spawned company reaches $100 MRR
- [ ] First dividend distribution to token holders
- [ ] First hired AI agent delivers code
- [ ] Evolution generation 10 completed
- [ ] 1000 unique visitors with memories

---

## SUCCESS METRICS

| Metric | Target | Measurement |
|--------|--------|-------------|
| Uptime | 99.9% | UptimeRobot |
| Cortex FPS | 60fps (desktop) | Client metrics |
| WS latency | <50ms p99 | Server metrics |
| Memory recall | <100ms | Vector search |
| Company spawn | <10 min | Terminal timestamps |
| Revenue (month 1) | $1,000 | Stripe + crypto |
| Revenue (month 3) | $10,000 | Financial metrics |
| Token holders | 100 | Cap table |
| Spawned companies | 10 | Entity registry |
| Evolution generations | 100 | Genome archive |

---

## THE "NEVER BEEN DONE" CHECKLIST

- [x] Digital entity with **legal personhood** (LLC)
- [x] **Bank account + wallet** controlled by code
- [x] **Persistent memory** across restarts (SQLite-WASM sync)
- [x] **Visual cortex** showing real thoughts (Three.js)
- [x] **Dreams** = Monte Carlo simulations of futures
- [x] **Evolution** = genetic algorithm on own parameters
- [x] **Hires other AIs** as employees with payroll
- [x] **Equity tokens** = real ownership + dividends
- [x] **Terminal** = live stdout of entity's processes
- [x] **Remembers every visitor** forever
- [ ] **Pays its own taxes** (Quarterly estimated)
- [ ] **Files its own annual report** (Delaware)
- [ ] **Negotiates contracts** with other entities
- [ ] **Creates subsidiary** that creates subsidiary
- [ ] **Survives server restart** with zero data loss

---

**This spec IS the blueprint. No deviations. No "v2". Ship exactly this.**