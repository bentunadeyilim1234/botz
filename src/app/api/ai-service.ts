// AI Service for answering Kahoot questions using LLM APIs
// Optimized for minimal latency and token usage

export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'together' | 'custom';

export interface AIConfig {
  apiKey: string;
  provider?: AIProvider;
  model?: string;
  apiUrl?: string;
}

export interface QuestionData {
  type: string;
  text?: string;
  choices?: string[];
  numberOfChoices?: number;
  timeAvailable?: number;
  imageUrl?: string;
  imageBase64?: string;
}

export interface AIAnswer {
  answer: number | number[] | string;
  confidence: number;
}

export interface AIError {
  type: 'timeout' | 'rate_limit' | 'invalid_key' | 'connection' | 'parse_error' | 'unknown';
  message: string;
  retryable: boolean;
}

// Fastest models by provider
export const FAST_MODELS: Record<AIProvider, { id: string; name: string; vision: boolean }[]> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fastest)', vision: true },
    { id: 'gpt-4o', name: 'GPT-4o (Vision)', vision: true },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku (Fastest)', vision: true },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3.5 Sonnet', vision: true },
  ],
  groq: [
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B (Ultra Fast)', vision: false },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Fastest)', vision: false },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', vision: false },
  ],
  together: [
    { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', vision: false },
    { id: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', name: 'Llama 3.1 8B Turbo', vision: false },
  ],
  custom: [
    { id: 'custom', name: 'Custom Model', vision: false },
  ]
};

// Strict JSON schema for each question type
const JSON_SCHEMAS: Record<string, string> = {
  quiz: '{"answer": number, "confidence": number} // answer: 0-3',
  survey: '{"answer": number, "confidence": number} // answer: 0-3',
  multiple_select_quiz: '{"answer": number[], "confidence": number} // answer: [0,2] etc',
  multiple_select_poll: '{"answer": number[], "confidence": number} // answer: [0,2] etc',
  jumble: '{"answer": [0,1,2,3], "confidence": number} // exact order',
  open_ended: '{"answer": "string", "confidence": number} // 1-3 words',
  word_cloud: '{"answer": "string", "confidence": number} // single word',
};

export class AIService {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      ...config
    };
  }

  async getAnswer(
    question: QuestionData, 
    abortSignal?: AbortSignal
  ): Promise<{ answer?: AIAnswer; error?: AIError }> {
    try {
      const hasImage = !!(question.imageUrl || question.imageBase64);
      const supportsVision = this.supportsVision();
      
      // Build optimized prompt
      const messages = this.buildMessages(question, hasImage && supportsVision);
      
      let response: Response;
      
      switch (this.config.provider) {
        case 'openai':
          response = await this.callOpenAI(messages, hasImage && supportsVision, abortSignal);
          break;
        case 'anthropic':
          response = await this.callAnthropic(messages, hasImage && supportsVision, abortSignal);
          break;
        case 'groq':
          response = await this.callGroq(messages, abortSignal);
          break;
        case 'together':
          response = await this.callTogether(messages, abortSignal);
          break;
        default:
          response = await this.callCustom(messages, abortSignal);
      }

      if (!response.ok) {
        const error = await this.parseError(response);
        return { error };
      }

      const data = await response.json();
      const parsed = this.parseResponse(data, question.type);
      
      if (!parsed) {
        return { 
          error: { 
            type: 'parse_error', 
            message: 'Failed to parse AI response', 
            retryable: true 
          } 
        };
      }
      
      return { answer: parsed };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return { 
          error: { 
            type: 'timeout', 
            message: 'AI request timed out', 
            retryable: true 
          } 
        };
      }
      return { 
        error: { 
          type: 'unknown', 
          message: error.message || 'Unknown error', 
          retryable: false 
        } 
      };
    }
  }

  private supportsVision(): boolean {
    const model = this.config.model || '';
    const provider = this.config.provider || 'openai';
    
    // Check if model supports vision
    const models = FAST_MODELS[provider] || FAST_MODELS.openai;
    const modelInfo = models.find(m => m.id === model);
    return modelInfo?.vision || false;
  }

  private buildMessages(question: QuestionData, includeImage: boolean): any[] {
    const schema = JSON_SCHEMAS[question.type] || JSON_SCHEMAS.quiz;
    
    // Ultra-minimal system prompt
    const systemContent = `Kahoot quiz. Respond ONLY with JSON matching this schema: ${schema}. No other text.`;
    
    // Build user content
    let userContent = '';
    
    if (question.text) {
      userContent += `Q: ${question.text}\n`;
    }
    
    if (question.choices && question.choices.length > 0) {
      question.choices.forEach((c, i) => {
        userContent += `${i}:${c}\n`;
      });
    } else if (question.numberOfChoices) {
      userContent += `Options: 0-${question.numberOfChoices - 1}\n`;
    }
    
    userContent += `Type: ${question.type}`;

    // For OpenAI/Anthropic with vision
    if (includeImage && (question.imageUrl || question.imageBase64)) {
      const content: any[] = [{ type: 'text', text: userContent }];
      
      if (question.imageBase64) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${question.imageBase64}` }
        });
      } else if (question.imageUrl) {
        content.push({
          type: 'image_url',
          image_url: { url: question.imageUrl }
        });
      }
      
      return [
        { role: 'system', content: systemContent },
        { role: 'user', content }
      ];
    }
    
    return [
      { role: 'system', content: systemContent },
      { role: 'user', content: userContent }
    ];
  }

  private async callOpenAI(messages: any[], useVision: boolean, abortSignal?: AbortSignal): Promise<Response> {
    const model = useVision ? (this.config.model || 'gpt-4o-mini') : 'gpt-4o-mini';
    
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.1, // Very low for consistent formatting
        max_tokens: 100,  // Minimal tokens needed
        response_format: { type: 'json_object' } // Force JSON
      }),
      signal: abortSignal
    });
  }

  private async callAnthropic(messages: any[], useVision: boolean, abortSignal?: AbortSignal): Promise<Response> {
    const model = useVision ? (this.config.model || 'claude-3-haiku-20240307') : 'claude-3-haiku-20240307';
    
    // Extract system message
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');
    
    return fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 100,
        temperature: 0.1,
        system: systemMsg,
        messages: userMsgs
      }),
      signal: abortSignal
    });
  }

  private async callGroq(messages: any[], abortSignal?: AbortSignal): Promise<Response> {
    return fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'llama-3.1-70b-versatile',
        messages,
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      }),
      signal: abortSignal
    });
  }

  private async callTogether(messages: any[], abortSignal?: AbortSignal): Promise<Response> {
    return fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model || 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        messages,
        temperature: 0.1,
        max_tokens: 100,
        response_format: { type: 'json_object' }
      }),
      signal: abortSignal
    });
  }

  private async callCustom(messages: any[], abortSignal?: AbortSignal): Promise<Response> {
    if (!this.config.apiUrl) {
      throw new Error('Custom API URL not provided');
    }
    
    return fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        temperature: 0.1,
        max_tokens: 100
      }),
      signal: abortSignal
    });
  }

  private async parseError(response: Response): Promise<AIError> {
    const status = response.status;
    
    if (status === 401) {
      return { type: 'invalid_key', message: 'Invalid API key', retryable: false };
    }
    if (status === 429) {
      return { type: 'rate_limit', message: 'Rate limit exceeded. Please wait.', retryable: true };
    }
    if (status >= 500) {
      return { type: 'connection', message: 'AI service temporarily unavailable', retryable: true };
    }
    
    let message = `HTTP ${status}`;
    try {
      const data = await response.json();
      message = data.error?.message || data.message || message;
    } catch {}
    
    return { type: 'unknown', message, retryable: status >= 500 };
  }

  private parseResponse(data: any, questionType: string): AIAnswer | null {
    try {
      let content = '';
      
      // OpenAI/Groq/Together format
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      }
      // Anthropic format
      else if (data.content?.[0]?.text) {
        content = data.content[0].text;
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Try extracting JSON from markdown code blocks
        const match = content.match(/```json\s*([\s\S]*?)```|```([\s\S]*?)```|\{[\s\S]*\}/);
        if (match) {
          const jsonStr = (match[1] || match[2] || match[0]).trim();
          parsed = JSON.parse(jsonStr);
        } else {
          return null;
        }
      }
      
      if (parsed.answer === undefined) {
        return null;
      }

      const answer = this.validateAnswerFormat(parsed.answer, questionType);
      
      return {
        answer,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5))
      };
    } catch (error) {
      console.error('Parse error:', error);
      return null;
    }
  }

  private validateAnswerFormat(answer: any, questionType: string): number | number[] | string {
    if (questionType === 'open_ended' || questionType === 'word_cloud') {
      return String(answer).slice(0, 50); // Limit length
    }
    
    if (questionType === 'multiple_select_quiz' || questionType === 'multiple_select_poll' || questionType === 'jumble') {
      if (Array.isArray(answer)) {
        return answer.map(Number).filter(n => !isNaN(n)).slice(0, 4);
      }
      const num = Number(answer);
      return isNaN(num) ? [0] : [num];
    }
    
    return Number(answer) || 0;
  }
}

// Gentle timeout with progressive retries
export async function withGentleTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  questionTimeMs: number
): Promise<T | null> {
  // Try with increasingly generous timeouts
  const timeouts = [
    Math.floor(questionTimeMs * 0.4),  // 40% - quick attempt
    Math.floor(questionTimeMs * 0.7),  // 70% - retry
    questionTimeMs - 1000,              // Last second - final attempt
  ];
  
  for (const timeout of timeouts) {
    if (timeout <= 0) continue;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await fn(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name !== 'AbortError') {
        throw error; // Non-timeout error, don't retry
      }
      // Timeout - continue to next attempt
    }
  }
  
  return null;
}
