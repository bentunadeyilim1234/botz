declare module 'kahoot.js-latest' {
  export default class Kahoot {
    constructor();
    join(pin: string | number, name: string): Promise<void>;
    leave(): void;
    answer(answer: number | number[] | string): void;
    on(event: 'Joined', callback: () => void): void;
    on(event: 'QuizStart', callback: () => void): void;
    on(event: 'QuestionStart', callback: (question: any) => void): void;
    on(event: 'QuestionEnd', callback: () => void): void;
    on(event: 'Disconnect', callback: (reason: string) => void): void;
    on(event: string, callback: (...args: any[]) => void): void;
  }
}

// AI Service types
export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'together' | 'custom';
export type BotMode = 'auto' | 'takeover' | 'ai';

export interface AIConfig {
  apiKey: string;
  provider?: AIProvider;
  model?: string;
  apiUrl?: string;
}

export interface TaskConfig {
  mode: BotMode;
  useExactName: boolean;
  aiConfig?: AIConfig;
}

export interface AIError {
  type: 'timeout' | 'rate_limit' | 'invalid_key' | 'connection' | 'parse_error' | 'unknown';
  message: string;
  retryable: boolean;
}
