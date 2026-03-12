// We use require instead of import to prevent Turbopack from trying to bundle this older CJS module
// which lacks precise exports.
const Kahoot = require("kahoot.js-latest");
import { 
  AIService, 
  AIConfig, 
  QuestionData, 
  withGentleTimeout,
  AIError 
} from './ai-service';

export type BotMode = 'auto' | 'takeover' | 'ai';

export interface TaskConfig {
  mode: BotMode;
  useExactName: boolean;
  aiConfig?: AIConfig;
}

export class AutomationEngine {
  // Map taskId -> array of Kahoot instances
  private activeClients: Map<string, any[]> = new Map();
  private abortSignals: Map<string, AbortController> = new Map();
  private taskConfigs: Map<string, TaskConfig> = new Map();
  private currentQuestion: Map<string, any> = new Map();
  private aiServices: Map<string, AIService> = new Map();

  // Real-time Event Emitter for SSE
  private eventListeners: ((event: any) => void)[] = [];

  constructor() {}

  public addEventListener(listener: (event: any) => void) {
    this.eventListeners.push(listener);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== listener);
    };
  }

  public emit(event: any) {
    this.eventListeners.forEach((listener) => listener(event));
  }

  async runTask(
    taskId: string,
    gamePin: string,
    nameAlias: string,
    threads: number,
    useProxy: boolean,
    config: TaskConfig,
    logCallback: (msg: string) => void
  ) {
    const abortController = new AbortController();
    this.abortSignals.set(taskId, abortController);
    this.activeClients.set(taskId, []);
    this.taskConfigs.set(taskId, config);
    
    // Initialize AI service if in AI mode
    if (config.mode === 'ai' && config.aiConfig) {
      this.aiServices.set(taskId, new AIService(config.aiConfig));
    }

    logCallback(`[Engine] Initializing ${threads} bots in ${config.mode.toUpperCase()} mode...`);
    if (config.useExactName && threads === 1) {
      logCallback(`[Engine] Using exact name: ${nameAlias}`);
    }

    // Automatically abort task after 10 minutes to prevent zombie processes
    const timeoutId = setTimeout(() => {
      logCallback(`[Engine] 10-minute timeout reached. Automatically aborting task...`);
      this.abortTask(taskId);
    }, 10 * 60 * 1000);

    const promises = [];
    for (let i = 0; i < threads; i++) {
      promises.push(
        this.runSingleClient(
          taskId,
          gamePin,
          nameAlias,
          i + 1,
          threads,
          useProxy,
          config,
          logCallback,
          abortController.signal
        )
      );
      // Slight stagger to avoid rate limits
      await new Promise((r) => setTimeout(r, 50));
    }

    try {
      await Promise.allSettled(promises);
      logCallback(`[Engine] All clients disconnected for task.`);
    } finally {
      clearTimeout(timeoutId);
      this.cleanupTask(taskId);
    }
  }

  private async runSingleClient(
    taskId: string,
    gamePin: string,
    nameAlias: string,
    threadIndex: number,
    totalThreads: number,
    useProxy: boolean,
    config: TaskConfig,
    logCallback: (msg: string) => void,
    signal: AbortSignal
  ) {
    return new Promise<void>((resolve) => {
      const client = new Kahoot();

      // Store client for answering/aborting
      const taskClients = this.activeClients.get(taskId);
      if (taskClients) taskClients.push(client);

      // Generate username based on settings
      let finalUsername: string;
      if (config.useExactName && totalThreads === 1) {
        finalUsername = nameAlias;
      } else {
        const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
        let randomSuffix = "";
        for (let i = 0; i < 4; i++) {
          randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        finalUsername = `${nameAlias}-${randomSuffix}`;
      }

      // Handle AbortSignal to disconnect gracefully
      const abortHandler = () => {
        client.leave();
        resolve();
      };
      signal.addEventListener("abort", abortHandler);

      client.on("Joined", () => {
        logCallback(`[Thread ${threadIndex}] ${finalUsername} joined successfully.`);
      });

      client.on("QuizStart", () => {
        logCallback(`[Thread ${threadIndex}] Quiz started!`);
      });

      client.on("QuestionStart", (question: any) => {
        logCallback(`[Thread ${threadIndex}] Question started: ${question.type}`);
        
        // Store current question for AI mode
        this.currentQuestion.set(taskId, question);
        
        // Extract image URL if present
        const hasImage = !!(question.image || question.imageUrl || question.imageMetadata);
        
        // Emit the active question to SSE listeners
        if (threadIndex === 1) {
          this.emit({ 
            type: 'question_active', 
            taskId, 
            question: { 
              type: question.type, 
              choiceAmount: question.numberOfChoices || 4,
              text: question.text || question.question,
              time: question.time || question.timeAvailable || 20000,
              hasImage
            } 
          });
        }
        
        // Handle auto mode - distribute answers evenly
        if (config.mode === 'auto') {
          this.handleAutoAnswer(taskId, client, threadIndex, question, logCallback);
        }
        
        // Handle AI mode - query LLM (only first bot triggers AI)
        if (config.mode === 'ai' && threadIndex === 1) {
          this.handleAIAnswer(taskId, client, question, logCallback, signal);
        }
      });

      client.on("QuestionEnd", () => {
        if (threadIndex === 1) {
          this.emit({ type: 'question_ended', taskId });
        }
      });

      client.on("Disconnect", (reason: string) => {
        logCallback(`[Thread ${threadIndex}] Disconnected: ${reason}`);
        signal.removeEventListener("abort", abortHandler);
        resolve();
      });

      logCallback(`[Thread ${threadIndex}] Attempting connection...`);
      
      client.join(gamePin, finalUsername).catch((err: any) => {
        logCallback(`[Thread ${threadIndex}] Join error: ${err.message || err.description || "Unknown error"}`);
        signal.removeEventListener("abort", abortHandler);
        resolve();
      });
    });
  }

  private handleAutoAnswer(
    taskId: string,
    client: any,
    threadIndex: number,
    question: any,
    logCallback: (msg: string) => void
  ) {
    const type = question.type || 'quiz';
    const choiceCount = question.numberOfChoices || 4;
    
    let answer: number | number[] | string;
    
    // Distribute answers evenly across bots for variety
    if (type === 'multiple_select_quiz' || type === 'multiple_select_poll') {
      // For multi-select, each bot picks a random subset
      const numSelections = Math.floor(Math.random() * choiceCount) + 1;
      const selections: number[] = [];
      while (selections.length < numSelections) {
        const r = Math.floor(Math.random() * choiceCount);
        if (!selections.includes(r)) selections.push(r);
      }
      answer = selections.sort((a, b) => a - b);
    } else if (type === 'open_ended' || type === 'word_cloud') {
      // Random common words for word cloud
      const words = ['Awesome', 'Great', 'Fun', 'Cool', 'Nice', 'Good', 'Yes', 'Wow'];
      answer = words[Math.floor(Math.random() * words.length)];
    } else if (type === 'jumble') {
      // Random shuffle for jumble
      answer = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    } else {
      // Standard quiz - distribute evenly then add some randomness
      const baseAnswer = threadIndex % choiceCount;
      // 70% chance to use distributed answer, 30% random
      answer = Math.random() > 0.3 ? baseAnswer : Math.floor(Math.random() * choiceCount);
    }
    
    // Small random delay to seem more natural (100-500ms)
    const delay = 100 + Math.random() * 400;
    
    setTimeout(() => {
      try {
        client.answer(answer);
        logCallback(`[Thread ${threadIndex}] Auto-answered: ${JSON.stringify(answer)}`);
      } catch (e) {
        logCallback(`[Thread ${threadIndex}] Failed to auto-answer`);
      }
    }, delay);
  }

  private async handleAIAnswer(
    taskId: string,
    client: any,
    question: any,
    logCallback: (msg: string) => void,
    signal: AbortSignal
  ) {
    const aiService = this.aiServices.get(taskId);
    if (!aiService) return;

    const type = question.type || 'quiz';
    const timeAvailable = question.time || question.timeAvailable || 20000;
    
    // Use gentle timeout with progressive retries
    // Try up to the last second before question ends
    logCallback(`[AI] Analyzing question with gentle timeout (${timeAvailable}ms available)...`);

    // Extract image URL if present
    const imageUrl = question.image || question.imageUrl || 
                     question.imageMetadata?.url || question.imageMetadata?.content;

    const questionData: QuestionData = {
      type: type,
      text: question.text || question.question || '',
      choices: question.choices || question.options,
      numberOfChoices: question.numberOfChoices || 4,
      timeAvailable: timeAvailable,
      imageUrl: imageUrl
    };

    // Use gentle timeout that tries multiple times with increasing timeouts
    const result = await withGentleTimeout(
      async (abortSignal) => {
        const response = await aiService.getAnswer(questionData, abortSignal);
        return response;
      },
      timeAvailable
    );

    if (result?.answer && !result.error) {
      logCallback(`[AI] Got answer: ${JSON.stringify(result.answer.answer)} (confidence: ${result.answer.confidence.toFixed(2)})`);
      
      // Emit success event
      this.emit({ type: 'ai_success', taskId });
      
      // Apply answer to all clients in the task
      const clients = this.activeClients.get(taskId);
      if (clients) {
        clients.forEach((c, idx) => {
          // Slight stagger to avoid all answering at exact same moment
          setTimeout(() => {
            try {
              c.answer(result.answer!.answer);
            } catch (e) {}
          }, idx * 50);
        });
      }
    } else {
      // Handle error
      const error = result?.error || { type: 'unknown', message: 'No result', retryable: false };
      logCallback(`[AI] Error: ${error.message}. Falling back to random answers...`);
      
      // Emit error event to frontend
      this.emit({ 
        type: 'ai_error', 
        taskId, 
        errorType: error.type,
        message: error.message 
      });
      
      // Fallback to random for all bots
      const clients = this.activeClients.get(taskId);
      if (clients) {
        clients.forEach((c, idx) => {
          setTimeout(() => this.handleAutoAnswer(taskId, c, idx + 1, question, logCallback), idx * 50);
        });
      }
    }
  }

  // Method for manual answering (takeover mode)
  async answerTask(taskId: string, answer: number | number[] | string) {
    const clients = this.activeClients.get(taskId);
    if (!clients) return false;

    for (const client of clients) {
      try {
        client.answer(answer);
      } catch (e) { /* Ignore if client already disconnected */ }
    }
    return true;
  }

  async abortTask(taskId: string) {
    const signal = this.abortSignals.get(taskId);
    if (signal) {
      signal.abort();
    }

    const clients = this.activeClients.get(taskId);
    if (clients) {
      for (const client of clients) {
        try {
          client.leave();
        } catch (e) {}
      }
    }

    this.cleanupTask(taskId);
  }

  private cleanupTask(taskId: string) {
    this.activeClients.delete(taskId);
    this.abortSignals.delete(taskId);
    this.taskConfigs.delete(taskId);
    this.currentQuestion.delete(taskId);
    this.aiServices.delete(taskId);
  }
}
