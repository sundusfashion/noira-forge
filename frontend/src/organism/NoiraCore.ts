import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Types for organism state
export interface LegalEntity {
  id: string;
  name: string;
  ein?: string;
  status: string;
  createdAt: number;
  wallet?: string;
  deployUrl?: string;
  capitalCents?: number;
}

export interface Neuron {
  id: string
  type: 'episodic' | 'semantic' | 'procedural' | 'dream' | 'decision'
  position: [number, number, number]
  activation: number
  connections: string[]
  metadata: MemoryMetadata
}

export interface MemoryEvent {
  id: string
  timestamp: number
  type: MemoryEventType
  title: string
  content: string
  metadata: Record<string, any>
  neuronId?: string
  importance: number
}

export type MemoryEventType =
  | 'episodic'
  | 'semantic'
  | 'procedural'
  | 'dream'
  | 'decision'
  | 'financial'
  | 'hired'
  | 'evolution'

export interface MemoryMetadata {
  title: string
  content: string
  timestamp: number
  importance: number
  type: string
}

export interface FinancialMetrics {
  cash: number      // USD cents
  monthlyRevenue: number
  monthlyExpenses: number
  runway: number    // months
  valuation: number // USD
  equityValue: number // per share
}

export interface CapTableState {
  totalShares: number
  holdings: HoldingState[]
}

export interface HoldingState {
  address: string
  shares: number
  percentage: number
  type: 'founder' | 'investor' | 'employee' | 'treasury'
}

export interface OrganismState {
  // Identity
  name: string
  birthTimestamp: number
  version: string
  
  // Neural state
  neurons: Map<string, Neuron>
  activeThoughts: ThoughtFlow[]
  currentMode: 'awake' | 'dreaming' | 'deciding'
  
  // Memory
  memoryStream: MemoryEvent[]
  memoryIndex: Map<string, number> // neuronId -> index in cortex
  
  // Financial
  wallet: string // Base/Ethereum address
  capTable: CapTableState
  financial: FinancialMetrics
  
  // Legal
  entities: LegalEntity[]
  
  // Evolution
  genome: Genome
  generation: number
  
  // WebSocket connection
  ws: WebSocket | null
  isConnected: boolean
  
  // Actions
  connectWS: (url: string) => Promise<void>
  disconnectWS: () => void
  addNeuron: (neuron: Neuron) => void
  removeNeuron: (neuronId: string) => void
  updateNeuronActivation: (neuronId: string, activation: number) => void
  addMemory: (event: MemoryEvent) => void
  removeMemory: (eventId: string) => void
  updateFinancial: (metrics: Partial<FinancialMetrics>) => void
  addHolding: (holding: HoldingState) => void
  removeHolding: (address: string) => void
  setMode: (mode: 'awake' | 'dreaming' | 'deciding') => void
  sendCommand: (command: string) => Promise<void>
  chatMessage: (message: string) => Promise<void>
}

export type ThoughtFlow = {
  id: string
  neurons: string[] // neuron IDs involved
  type: 'signal' | 'pattern' | 'insight' | 'decision'
  strength: number
  timestamp: number
}

export interface Genome {
  riskTolerance: number      // 0-1
  revenueWeight: number     // 0-1
  growthWeight: number      // 0-1
  hiringThreshold: number   // 0-1
  simulationIterations: number
  consolidationInterval: number
  dreamFrequency: number
  investmentStrategy: 'conservative' | 'balanced' | 'aggressive'
}

export const useStore = create<OrganismState>()(
  persist(
    (set, get) => ({
      // Initial state
      name: 'Noira Forge',
      birthTimestamp: Date.now(),
      version: '0.1.0',
      generation: 1,
      neurons: new Map(),
      activeThoughts: [],
      currentMode: 'awake',
      memoryStream: [],
      memoryIndex: new Map(),
      wallet: '',
      capTable: {
        totalShares: 1000000,
        holdings: []
      },
      financial: {
        cash: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        runway: 0,
        valuation: 0,
        equityValue: 0
      },
      entities: [],
      genome: {
        riskTolerance: 0.5,
        revenueWeight: 0.5,
        growthWeight: 0.5,
        hiringThreshold: 0.5,
        simulationIterations: 100,
        consolidationInterval: 3600,
        dreamFrequency: 21600, // every 6 hours
        investmentStrategy: 'balanced'
      },
      ws: null,
      isConnected: false,

      // WebSocket connect
      connectWS: async (url: string) => {
        const ws = new WebSocket(url)
        
        return new Promise<void>((resolve) => {
          ws.onopen = () => {
            set({ ws, isConnected: true })
            resolve()
          }
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
              if (data.type === 'state_update') {
                set(prev => ({
                  ...prev,
                  neurons: new Map(data.neurons.map((n: any) => [n.id, n])),
                  memoryStream: [...prev.memoryStream, ...data.newEvents].slice(-500),
                  capTable: data.capTable,
                  financial: data.financial,
                  currentMode: data.mode || 'awake'
                }))
              } else if (data.type === 'memory_event') {
                set(prev => ({
                  ...prev,
                  memoryStream: [...prev.memoryStream, data.event].slice(-1000)
                }))
              } else if (data.type === 'neuron_update') {
                set(prev => {
                  const newNeurons = new Map(prev.neurons)
                  newNeurons.set(data.neuron.id, data.neuron)
                  return { neurons: newNeurons }
                })
              }
            } catch (e) {
              console.error('WS message parse error:', e)
            }
          }
          
          ws.onclose = () => {
            set({ isConnected: false })
            // Attempt reconnect after 5 seconds
            setTimeout(() => get().connectWS(url), 5000)
          }
          
          ws.onerror = (err) => {
            console.error('WS error:', err)
            set({ isConnected: false })
          }
        })
      },

      // WebSocket disconnect
      disconnectWS: () => {
        get().ws?.close()
        set({ ws: null, isConnected: false })
      },

      // Add neuron to cortex
      addNeuron: (neuron: Neuron) =>
        set(prev => {
          const newNeurons = new Map(prev.neurons)
          newNeurons.set(neuron.id, neuron)
          return { neurons: newNeurons }
        }),

      // Remove neuron
      removeNeuron: (neuronId: string) =>
        set(prev => {
          const newNeurons = new Map(prev.neurons)
          newNeurons.delete(neuronId)
          // Also remove from memory index
          const newIndex = new Map(prev.memoryIndex)
          newIndex.delete(neuronId)
          return { neurons: newNeurons, memoryIndex: newIndex }
        }),

      // Update neuron activation
      updateNeuronActivation: (neuronId: string, activation: number) =>
        set(prev => {
          const newNeurons = new Map(prev.neurons)
          const neuron = newNeurons.get(neuronId)
          if (neuron) {
            neuron.activation = activation
            newNeurons.set(neuronId, neuron)
          }
          return { neurons: newNeurons }
        }),

      // Add memory event
      addMemory: (event: MemoryEvent) =>
        set(prev => ({
          memoryStream: [...prev.memoryStream, event].slice(-1000)
        })),

      // Remove memory
      removeMemory: (eventId: string) =>
        set(prev => ({
          memoryStream: prev.memoryStream.filter(m => m.id !== eventId)
        })),

      // Update financial metrics
      updateFinancial: (metrics: Partial<FinancialMetrics>) =>
        set(prev => ({
          financial: { ...prev.financial, ...metrics }
        })),

      // Add holding
      addHolding: (holding: HoldingState) =>
        set(prev => ({
          capTable: {
            totalShares: prev.capTable.totalShares + 1,
            holdings: [...prev.capTable.holdings, holding]
          }
        })),

      // Remove holding
      removeHolding: (address: string) =>
        set(prev => ({
          capTable: {
            totalShares: Math.max(1, prev.capTable.totalShares - 1),
            holdings: prev.capTable.holdings.filter(h => h.address !== address)
          }
        })),

      // Set mode
      setMode: (mode: 'awake' | 'dreaming' | 'deciding') =>
        set({ currentMode: mode }),

      // Send command via terminal
      sendCommand: async (command: string) => {
        // Could send via WebSocket to server
        // For now, just log
        console.log('Command sent:', command)
      },

      // Chat message with memory retrieval
      chatMessage: async (message: string) => {
        // Store user message in memory
        const userMemory: MemoryEvent = {
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          type: 'semantic',
          title: 'Chat message',
          content: message,
          metadata: { role: 'user' },
          importance: 0.6
        }
        
        // Store in organism memory
        get().addMemory(userMemory)
        
        // TODO: Send to LLM with context, get response
        // For now, auto-response simulation
        const responses = [
          "Synaptic activity detected. Processing your consciousness...",
          "Memory trace created. Connecting to existing knowledge...",
          "New insight: your query resonates with prior learnings.",
          "Capital allocation considered. Revenue pathways analyzed."
        ]
        
        const response = responses[Math.floor(Math.random() * responses.length)]
        
        const noiraMemory: MemoryEvent = {
          id: `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          timestamp: Date.now(),
          type: 'semantic',
          title: 'Noira response',
          content: response,
          metadata: { role: 'noira' },
          importance: 0.8
        }
        
        get().addMemory(noiraMemory)
      }
    }),
    {
      name: 'noira-organism-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
)