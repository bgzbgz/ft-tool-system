/**
 * Fast Track AI Provider Service
 * Spec: V4-IN-HOUSE-AI-ARCHITECTURE
 *
 * Unified interface for Claude and Gemini AI providers
 */

import Anthropic from '@anthropic-ai/sdk';

// ========== CONFIGURATION ==========

export interface AIProviderConfig {
  provider: 'claude' | 'gemini';
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  model: string;
  latencyMs: number;
}

// Default configurations
const DEFAULT_CONFIG = {
  claude: {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192'),
    temperature: 0.3
  },
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    maxTokens: parseInt(process.env.AI_MAX_TOKENS || '8192'),
    temperature: 0.3
  }
};

// ========== PROVIDER CLIENTS ==========

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ========== CORE FUNCTIONS ==========

/**
 * Call Claude API
 */
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options?: Partial<AIProviderConfig>
): Promise<AIResponse> {
  const client = getAnthropicClient();
  const config = { ...DEFAULT_CONFIG.claude, ...options };

  const startTime = Date.now();

  const response = await client.messages.create({
    model: config.model,
    max_tokens: config.maxTokens!,
    temperature: config.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  const latencyMs = Date.now() - startTime;

  // Extract text content
  const textBlock = response.content.find(block => block.type === 'text');
  const content = textBlock && 'text' in textBlock ? textBlock.text : '';

  return {
    content,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    },
    model: response.model,
    latencyMs
  };
}

/**
 * Call Gemini API
 */
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  options?: Partial<AIProviderConfig>
): Promise<AIResponse> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not configured');
  }

  const config = { ...DEFAULT_CONFIG.gemini, ...options };
  const startTime = Date.now();

  // Gemini API call via REST
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }]
        }
      ],
      generationConfig: {
        maxOutputTokens: config.maxTokens,
        temperature: config.temperature
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;

  // Extract content from Gemini response
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Gemini doesn't return token counts in the same way
  const estimatedInputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  const estimatedOutputTokens = Math.ceil(content.length / 4);

  return {
    content,
    usage: {
      inputTokens: data.usageMetadata?.promptTokenCount || estimatedInputTokens,
      outputTokens: data.usageMetadata?.candidatesTokenCount || estimatedOutputTokens
    },
    model: config.model!,
    latencyMs
  };
}

/**
 * Unified AI call interface
 * Routes to appropriate provider based on configuration
 */
export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options?: AIProviderConfig
): Promise<AIResponse> {
  const provider = options?.provider ||
    (process.env.AI_PRIMARY_PROVIDER as 'claude' | 'gemini') ||
    'claude';

  console.log(`[AI] Calling ${provider} (model: ${options?.model || 'default'})...`);

  try {
    const response = provider === 'gemini'
      ? await callGemini(systemPrompt, userMessage, options)
      : await callClaude(systemPrompt, userMessage, options);

    console.log(`[AI] Response received in ${response.latencyMs}ms (${response.usage.outputTokens} tokens)`);
    return response;
  } catch (error) {
    console.error(`[AI] Error calling ${provider}:`, error);
    throw error;
  }
}

/**
 * Call AI with automatic retry on rate limits
 */
export async function callAIWithRetry(
  systemPrompt: string,
  userMessage: string,
  options?: AIProviderConfig,
  maxRetries: number = 3
): Promise<AIResponse> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(systemPrompt, userMessage, options);
    } catch (error) {
      lastError = error as Error;
      const isRateLimit = lastError.message.includes('rate_limit') ||
                          lastError.message.includes('429') ||
                          lastError.message.includes('quota');

      if (isRateLimit && attempt < maxRetries) {
        const waitMs = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.log(`[AI] Rate limited, waiting ${waitMs}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      } else {
        throw lastError;
      }
    }
  }

  throw lastError;
}

// ========== PROVIDER SELECTION ==========

/**
 * Get the configured provider for a specific agent role
 */
export function getProviderForRole(role: 'primary' | 'qa'): 'claude' | 'gemini' {
  if (role === 'qa') {
    // QA uses different model to avoid bias
    return (process.env.AI_QA_PROVIDER as 'claude' | 'gemini') || 'gemini';
  }
  return (process.env.AI_PRIMARY_PROVIDER as 'claude' | 'gemini') || 'claude';
}

/**
 * Check if AI providers are configured
 */
export function checkAIConfiguration(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  const primaryProvider = process.env.AI_PRIMARY_PROVIDER || 'claude';
  const qaProvider = process.env.AI_QA_PROVIDER || 'gemini';

  if (primaryProvider === 'claude' || qaProvider === 'claude') {
    if (!process.env.ANTHROPIC_API_KEY) {
      missing.push('ANTHROPIC_API_KEY');
    }
  }

  if (primaryProvider === 'gemini' || qaProvider === 'gemini') {
    if (!process.env.GOOGLE_AI_API_KEY) {
      missing.push('GOOGLE_AI_API_KEY');
    }
  }

  return {
    valid: missing.length === 0,
    missing
  };
}
