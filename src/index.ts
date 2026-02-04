
import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';

import { PerceivedTimeEvaluator } from './core/PerceivedTimeEvaluator.js';
import { resolvePersona } from './core/Persona.js';
import { TraceStep, PersonaConfig } from './core/types.js';
import { generateChineseReport } from './core/ReportGenerator.js';

const app = express();
app.use(cors());

// Initialize MCP Server
const server = new McpServer({
  name: 'UXExperienceEvaluator',
  version: '2.0.0',
});

const evaluator = new PerceivedTimeEvaluator();

// Tool: resolve_persona
server.tool(
  'resolve_persona',
  {
    input: z.string().describe('Persona ID (e.g. "xiao_fang", "novice") OR a JSON string description.'),
  },
  async ({ input }) => {
    try {
      let inputParam: string | Partial<PersonaConfig> = input;
      if (input.trim().startsWith('{')) {
        try {
          inputParam = JSON.parse(input);
        } catch (e) {
          // Ignore
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
);

// Tool: evaluate_experience
server.tool(
  'evaluate_experience',
  {
    steps: z.array(z.object({
      name: z.string(),
      duration: z.number(),
      category: z.enum(['perceived', 'partially_perceived', 'non_perceived', 'tool_overhead', 'diagnostic']),
      complexity: z.enum(['low', 'medium', 'high']),
      description: z.string().optional(),
      screenshot: z.string().optional()
    })).describe('List of TraceStep objects collected during the test'),
    persona: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      humanThinkTimeMs: z.number(),
      personaFactor: z.number(),
      expectationBias: z.number()
    }).describe('PersonaConfig object')
  },
  async ({ steps, persona }) => {
    try {
      // Cast input to expected types
      const traceSteps = steps as TraceStep[];
      const personaConfig = persona as PersonaConfig;

      const result = evaluator.evaluate(traceSteps, personaConfig);

      // Use the separated generator for the report
      const markdown = generateChineseReport(result, personaConfig);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
          {
            type: 'text',
            text: markdown,
          }
        ],
      };

    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }
);

// Express Routes for SSE
let transport: SSEServerTransport;

app.get('/sse', async (req, res) => {
  console.log('New SSE connection');
  transport = new SSEServerTransport('/messages', res);
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(404).send('Session not found');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Remote UX Evaluator MCP running on port ${PORT}`);
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
});
