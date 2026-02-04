#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { PerceivedTimeEvaluator } from './core/PerceivedTimeEvaluator.js';
import { resolvePersona } from './core/Persona.js';
import { TraceStep, PersonaConfig } from './core/types.js';

/**
 * UX Experience Evaluator MCP Server
 * 
 * Responsibilities:
 * 1. Persona Resolution: Convert user descriptions into quantitative persona parameters.
 * 2. Experience Evaluation: Process trace logs using the Perceived Time Model and generate reports.
 */
class UXExperienceEvaluatorServer {
  private server: Server;
  private evaluator: PerceivedTimeEvaluator;

  constructor() {
    this.server = new Server(
      {
        name: 'UXExperienceEvaluator',
        version: '2.0.0', // Major version bump for clean rewrite
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.evaluator = new PerceivedTimeEvaluator();

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'resolve_persona',
          description: 'CORE TOOL: Resolve a user persona configuration. Call this FIRST to get the persona parameters (humanThinkTimeMs, etc.) needed for evaluation. Input can be a preset ID (e.g. "xiao_fang") or a natural language description.',
          inputSchema: {
            type: 'object',
            properties: {
              input: {
                type: 'string', 
                description: 'Persona ID (e.g. "xiao_fang", "novice") OR a JSON string description.'
              },
            },
            required: ['input'],
          },
        },
        {
          name: 'evaluate_experience',
          description: 'CORE TOOL: Submit trace logs to calculate the UX score. Returns a detailed Markdown report. Use this AFTER collecting trace logs from browser actions.',
          inputSchema: {
            type: 'object',
            properties: {
              steps: {
                type: 'array',
                description: 'List of TraceStep objects collected during the test',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    duration: { type: 'number' },
                    category: { type: 'string', enum: ['perceived', 'partially_perceived', 'non_perceived', 'tool_overhead', 'diagnostic'] },
                    complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    description: { type: 'string' },
                    screenshot: { type: 'string' }
                  },
                  required: ['name', 'duration', 'category', 'complexity']
                }
              },
              persona: {
                type: 'object',
                description: 'PersonaConfig object (usually obtained from resolve_persona)',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  humanThinkTimeMs: { type: 'number' },
                  personaFactor: { type: 'number' },
                  expectationBias: { type: 'number' }
                },
                required: ['humanThinkTimeMs', 'personaFactor', 'expectationBias']
              }
            },
            required: ['steps', 'persona'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'resolve_persona':
          return this.handleResolvePersona(request.params.arguments);
        case 'evaluate_experience':
          return this.handleEvaluateExperience(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleResolvePersona(args: any) {
    if (!args || typeof args.input !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid input: string required');
    }

    try {
      let inputParam: string | Partial<PersonaConfig> = args.input;
      
      // Try to parse if it looks like a JSON object
      if (args.input.trim().startsWith('{')) {
        try {
          inputParam = JSON.parse(args.input);
        } catch (e) {
          // If parse fails, treat as string ID
        }
      }

      const persona = resolvePersona(inputParam);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(persona, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error resolving persona: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleEvaluateExperience(args: any) {
    if (!args || !Array.isArray(args.steps) || !args.persona) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid input: steps (array) and persona (object) required');
    }

    try {
      const steps = args.steps as TraceStep[];
      const persona = args.persona as PersonaConfig;

      const result = this.evaluator.evaluate(steps, persona);

      // Generate suggestions based on high pain scores
      const highPainSteps = result.breakdown.filter(s => s.final_pain_ms > 3000);
      const suggestions = highPainSteps.length > 0 
        ? highPainSteps.map(s => `1. **优化步骤 "${s.step}"**: 当前疼痛评分 ${(s.final_pain_ms/1000).toFixed(2)}s，建议检查加载性能或交互流程。`).join('\n')
        : '1. 整体体验良好，暂无显著痛点。';

      // Generate Standardized Markdown Report
      // This logic is hardcoded here to ensure consistency across all agents using this MCP.
      const markdown = `
# UX 体验测试报告

**测试时间**: ${new Date().toISOString().split('T')[0]}
**测试目标**: [请在此处填写测试目标]
**用户画像**: ${persona.name} (ThinkTime: ${persona.humanThinkTimeMs}ms, Factor: ${persona.personaFactor})
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2), // Keep JSON for programmatic access
          },
          {
            type: 'text',
            text: markdown, // The definitive report
          }
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error evaluating experience: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('UXExperienceEvaluator MCP Server running on stdio');
  }
}

const server = new UXExperienceEvaluatorServer();
server.run().catch(console.error);
