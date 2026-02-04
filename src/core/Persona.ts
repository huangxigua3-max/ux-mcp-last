import { PersonaConfig } from './types.js';

/**
 * Predefined Persona Configurations
 */
export const PERSONA_PRESETS: Record<string, PersonaConfig> = {
  XIAO_FANG: {
    id: 'xiao_fang',
    name: 'Expert Developer (Xiao Fang)',
    humanThinkTimeMs: 1000,
    personaFactor: 1.2,
    expectationBias: 0.7,
    description: 'Highly skilled, impatient with delays, expects high performance.'
  },
  XIAO_DIU: {
    id: 'xiao_diu',
    name: 'Novice PM (Xiao Diu)',
    humanThinkTimeMs: 2000,
    personaFactor: 0.8,
    expectationBias: 1.3,
    description: 'Learning phase, patient, needs time to read and understand.'
  }
};

/**
 * Helper to resolve a Persona Configuration from various inputs.
 * 
 * @param input Can be a preset ID (e.g., 'xiao_fang'), a partial config, or a full config.
 * @returns A complete PersonaConfig object.
 */
export function resolvePersona(input: string | Partial<PersonaConfig>): PersonaConfig {
  console.error(`[Persona] Resolving input: ${typeof input === 'string' ? input : JSON.stringify(input)}`);

  // 1. Check if input is a preset ID string
  if (typeof input === 'string') {
    const presetKey = Object.keys(PERSONA_PRESETS).find(k => 
      PERSONA_PRESETS[k].id === input || k === input.toUpperCase()
    );
    if (presetKey) {
      console.error(`[Persona] Found preset: ${presetKey}`);
      return PERSONA_PRESETS[presetKey];
    }
    // Default fallback if string doesn't match
    console.error(`[Persona] Preset '${input}' not found. Falling back to Xiao Fang.`);
    return PERSONA_PRESETS.XIAO_FANG;
  }

  // 2. Check if input is a config object
  // Merge with default (Xiao Fang) for safety
  console.error(`[Persona] Using custom config`);
  return {
    ...PERSONA_PRESETS.XIAO_FANG,
    ...input,
    // Ensure ID and Name are set if missing
    id: input.id || 'custom_persona',
    name: input.name || 'Custom Persona'
  };
}

/**
 * GUIDE FOR AGENTS: MAPPING NATURAL LANGUAGE TO PERSONA PARAMETERS
 * 
 * When a user provides a complex natural language description (e.g., "Industry Expert - Slightly Grumpy - Wide Knowledge"),
 * decompose it into the following dimensions and adjust parameters accordingly:
 * 
 * 1. humanThinkTimeMs (Cognitive Speed & Proficiency):
 *    - "Expert", "Pro", "Familiar", "Fast", "Wide Knowledge": 500 - 1000 ms (Fast)
 *    - "Standard", "Average": 1500 ms
 *    - "Novice", "Learning", "Careful", "Slow", "Unfamiliar": 2000 - 3000 ms (Slow)
 *    *Logic: Experts process information faster.*
 * 
 * 2. personaFactor (Sensitivity/Patience/Mood):
 *    - "Grumpy", "Impatient", "Urgent", "Stressed", "Critical": 1.2 - 1.5 (Amplifies pain significantly)
 *    - "Normal", "Calm", "Objective": 1.0
 *    - "Patient", "Casual", "Forgiving", "Fanboy": 0.6 - 0.9 (Reduces pain)
 *    *Logic: A grumpy user feels waiting time is longer/more painful.*
 * 
 * 3. expectationBias (Performance Standard):
 *    - "Demanding", "High Standards", "Expert", "Benchmark": 0.6 - 0.8 (Expects faster than average)
 *    - "Standard": 1.0
 *    - "Forgiving", "Low Expectations", "Beta User": 1.2 - 1.5 (Accepts slowness)
 *    *Logic: Experts usually have higher standards (lower bias value = tighter deadline).*
 * 
 * EXAMPLE MAPPING:
 * Input: "行业专家-略微暴躁-知识面广" (Industry Expert - Slightly Grumpy - Wide Knowledge)
 * Analysis:
 *  - "Industry Expert" -> humanThinkTimeMs = 800ms, expectationBias = 0.7
 *  - "Slightly Grumpy" -> personaFactor = 1.3 (Base 1.0 + 0.3 penalty)
 *  - "Wide Knowledge" -> Reinforces low Think Time
 * Result: { humanThinkTimeMs: 800, personaFactor: 1.3, expectationBias: 0.7 }
 */
