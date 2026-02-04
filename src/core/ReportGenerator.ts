import { EvaluationResult, PersonaConfig } from './types.js';

/**
 * Generates a standardized Chinese Markdown report for UX experience evaluation.
 * @param result The evaluation result from PerceivedTimeEvaluator
 * @param personaConfig The persona configuration used for evaluation
 * @returns A formatted Markdown string
 */
export function generateChineseReport(result: EvaluationResult, personaConfig: PersonaConfig): string {
  // Generate suggestions based on high pain scores
  const highPainSteps = result.breakdown.filter(s => s.final_pain_ms > 3000);
  const suggestions = highPainSteps.length > 0 
    ? highPainSteps.map(s => `1. **优化步骤 "${s.step}"**: 当前疼痛评分 ${(s.final_pain_ms/1000).toFixed(2)}s，建议检查加载性能或交互流程。`).join('\n')
    : '1. 整体体验良好，暂无显著痛点。';

  return `
# UX 体验测试报告

**测试时间**: ${new Date().toISOString().split('T')[0]}
**测试目标**: [请在此处填写测试目标]
**用户画像**: ${personaConfig.name || 'Unknown'} (ThinkTime: ${personaConfig.humanThinkTimeMs}ms, Factor: ${personaConfig.personaFactor})
- **Total Steps**: ${result.complexity.totalSteps}
- **Breakpoints**: ${result.complexity.breakpoints}

## 1. 核心结论
| 综合评分 | 总物理耗时 | 总感知耗时 | 总疼痛评分 |
| :--- | :--- | :--- | :--- |
| **${result.score}** | **${(result.totalPhysicalTime / 1000).toFixed(2)}s** | **${(result.totalBasePerceivedTime / 1000).toFixed(2)}s** | **${(result.totalPainScore / 1000).toFixed(2)}s** |

## 2. 详细链路数据
| 步骤 | 物理耗时 (s) | 感知耗时 (s) | 疼痛评分 (s) | 复杂度 | 截图 |
| :--- | :--- | :--- | :--- | :--- | :--- |
${result.breakdown.map(step => `| ${step.step} | ${(step.original_ms / 1000).toFixed(2)}s | ${(step.base_perceived_ms / 1000).toFixed(2)}s | ${(step.final_pain_ms / 1000).toFixed(2)}s | ${step.complexity} | ${step.screenshot ? `![Step](${step.screenshot})` : '-'} |`).join('\n')}

## 3. 改进建议
${suggestions}
  `;
}
