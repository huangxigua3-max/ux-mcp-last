export type TimeClass = 'perceived' | 'partially_perceived' | 'non_perceived' | 'tool_overhead' | 'diagnostic';
export type ComplexityLevel = 'low' | 'medium' | 'high';

export interface TraceStep {
  name: string;
  duration: number; // Raw physical time in ms
  category: TimeClass;
  complexity: ComplexityLevel;
  description?: string;
  screenshot?: string;
}

export interface PersonaConfig {
  /**
   * Unique identifier for the persona
   */
  id: string;
  
  /**
   * Display name of the persona (e.g., "Expert User")
   */
  name: string;

  /**
   * Base time (ms) required for cognitive processing in simple tasks.
   * Lower = Faster/Expert (e.g., 500ms)
   * Higher = Slower/Novice (e.g., 2000ms)
   */
  humanThinkTimeMs: number;

  /**
   * Sensitivity to delay.
   * > 1.0: Impatient/Sensitive (amplifies pain)
   * < 1.0: Patient/Forgiving (reduces pain)
   */
  personaFactor: number;

  /**
   * Performance expectation baseline.
   * < 1.0: Demanding (expects faster than standard)
   * > 1.0: Lenient (accepts slower than standard)
   */
  expectationBias: number;
  
  /**
   * Optional description for documentation
   */
  description?: string;
}

export interface EvaluationResult {
  totalPhysicalTime: number;
  totalBasePerceivedTime: number;
  totalPainScore: number;
  personaFactor: number;
  expectationBias: number;
  complexity: {
      validSteps: number;
      expectedTimeMs: number;
      totalSteps: number;    // Total number of recorded steps
      breakpoints: number;   // Number of interruptions/retries
  };
  score: string;
  breakdown: Array<{
    step: string;
    category: TimeClass;
    complexity: ComplexityLevel;
    original_ms: number;
    think_time_ms: number;
    base_perceived_ms: number;
    final_pain_ms: number;
    rule: string;
    screenshot?: string;
  }>;
}
