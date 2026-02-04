import { TraceStep, PersonaConfig, EvaluationResult } from './types.js';

export class PerceivedTimeEvaluator {
  private readonly COMPRESSION_FACTOR = 0.4;
  
  // Expected time thresholds (ms) per complexity level
  // Includes Think Time + System Response Time
  private readonly EXPECTED_TIMES = {
    'low': 1000,    // Simple click/check
    'medium': 3000, // Standard navigation/form
    'high': 6000    // Heavy page load/computation
  };

  // Complexity factors (multipliers for Base Perception)
  private readonly COMPLEXITY_FACTORS = {
    'low': 1.0,
    'medium': 1.2, // 20% penalty for standard complexity
    'high': 1.5    // 50% penalty for high complexity
  };

  // Attention loss factors (multipliers for Base Perception)
  // Represents how much "pain" is added due to broken flow/distractions
  private readonly ATTENTION_LOSS_FACTORS = {
      'low': 1.0,
      'medium': 1.3, // 30% penalty
      'high': 1.8    // 80% penalty
  };

  /**
   * Evaluate trace steps using a specific Persona Configuration
   * @param steps Raw trace steps
   * @param persona Persona Configuration object
   */
  evaluate(steps: TraceStep[], persona: PersonaConfig): EvaluationResult {
    const { humanThinkTimeMs, personaFactor, expectationBias } = persona;
    
    let totalPhysicalTime = 0;
    let totalBasePerceivedTime = 0;
    const breakdown = [];

    for (const step of steps) {
      let basePerceived = 0;
      let rule = '';
      let thinkTimeApplied = 0;
      
      // 1. Calculate Dynamic Think Time (Affected by Complexity)
      // High complexity = More time needed to process information
      const complexityFactor = this.COMPLEXITY_FACTORS[step.complexity] || 1.0;
      thinkTimeApplied = humanThinkTimeMs * complexityFactor;

      // 2. Calculate Base Perceived Duration (Physical + Dynamic Think)
      let baseDuration = 0;
      switch (step.category) {
        case 'perceived':
          // Full Wait + Think
          baseDuration = step.duration + thinkTimeApplied;
          break;
        case 'partially_perceived':
          // Compressed Action + Think
          baseDuration = (step.duration * this.COMPRESSION_FACTOR) + thinkTimeApplied;
          break;
        case 'non_perceived':
        case 'tool_overhead':
        case 'diagnostic':
          baseDuration = 0;
          break;
      }

      // 3. Calculate Final Pain Score (Affected by Attention Loss & Persona Sensitivity)
      // Attention Loss and Persona Factor are subjective multipliers that amplify the "pain" of the duration
      const attentionLoss = this.ATTENTION_LOSS_FACTORS[step.complexity] || 1.0;
      const finalPainScore = baseDuration * attentionLoss * personaFactor;

      // Rule description for debugging
      if (baseDuration > 0) {
          rule = `(Dur + Think[${thinkTimeApplied.toFixed(0)}]) * Attn[${attentionLoss}] * Pers[${personaFactor}]`;
      } else {
          rule = 'Exclude';
      }

      totalPhysicalTime += step.duration;
      totalBasePerceivedTime += baseDuration; // Base perception before pain multipliers

      breakdown.push({
        step: step.name,
        category: step.category,
        complexity: step.complexity,
        original_ms: Math.round(step.duration),
        think_time_ms: Math.round(thinkTimeApplied),
        base_perceived_ms: Math.round(baseDuration),
        final_pain_ms: Math.round(finalPainScore),
        rule: rule,
        screenshot: step.screenshot
      });
    }

    const totalPainScore = breakdown.reduce((sum, step) => sum + step.final_pain_ms, 0);
    
    // Dynamic Scoring: Calculate threshold based on complexity
    let expectedTime = 0;
    
    for (const step of breakdown) {
        // Skip overhead/diagnostic for expectation calculation
        if (step.category === 'tool_overhead' || step.category === 'diagnostic') continue;
        
        // Lookup expected time based on step complexity
        // We need to access the original step to get complexity
        const originalStep = steps.find(s => s.name === step.step);
        if (originalStep) {
            const baseExpected = this.EXPECTED_TIMES[originalStep.complexity] || this.EXPECTED_TIMES['medium'];
            expectedTime += baseExpected * expectationBias;
        } else {
            expectedTime += this.EXPECTED_TIMES['medium'] * expectationBias; // Fallback
        }
    }

    const validSteps = breakdown.filter(s => s.category !== 'tool_overhead' && s.category !== 'diagnostic').length;

    return {
      totalPhysicalTime,
      totalBasePerceivedTime,
      totalPainScore,
      personaFactor,
      expectationBias,
      complexity: {
          validSteps,
          expectedTimeMs: expectedTime,
          totalSteps: steps.length,
          breakpoints: steps.filter(s => s.category === 'diagnostic' && s.description?.includes('error')).length // Simple heuristic for breakpoints
      },
      score: this.calculateDynamicScore(totalPainScore, expectedTime),
      breakdown
    };
  }

  private calculateDynamicScore(actualMs: number, expectedMs: number): string {
    const ratio = actualMs / expectedMs;
    
    // If actual time is within 80% of expected -> Excellent
    if (ratio <= 0.8) return 'Excellent (S)';
    // If actual time is within 120% of expected -> Good
    if (ratio <= 1.2) return 'Good (A)';
    // If actual time is within 150% of expected -> Fair
    if (ratio <= 1.5) return 'Fair (B)';
    // Otherwise -> Poor
    return 'Poor (C)';
  }
}
