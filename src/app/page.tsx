"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  Play, Square, Settings2, Activity, MousePointer2, Send, 
  RotateCcw, Type, GripVertical, Bot, Brain, Gamepad2, User,
  AlertCircle, Check, Zap, Image as ImageIcon, X
} from "lucide-react";
import { FAST_MODELS, AIProvider } from './api/ai-service';

type BotMode = 'auto' | 'takeover' | 'ai';

interface AIConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
}

interface AIError {
  type: string;
  message: string;
}

interface Notification {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

export default function Home() {
  const [gamePin, setGamePin] = useState("");
  const [nameAlias, setNameAlias] = useState("");
  const [threads, setThreads] = useState(1);
  const [useProxy, setUseProxy] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  
  // Mode selection
  const [mode, setMode] = useState<BotMode>('takeover');
  const [useExactName, setUseExactName] = useState(false);
  
  // AI Configuration with localStorage
  const [aiConfig, setAiConfig] = useState<AIConfig>({
    apiKey: '',
    provider: 'openai',
    model: 'gpt-4o-mini'
  });
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'thinking' | 'error'>('idle');
  const [aiError, setAiError] = useState<AIError | null>(null);
  
  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Real-time state
  const [activeQuestion, setActiveQuestion] = useState<{
    type: string, 
    choiceAmount: number,
    text?: string,
    hasImage?: boolean
  } | null>(null);
  const [currentMode, setCurrentMode] = useState<BotMode>('takeover');
  
  // Multi-select state
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  
  // Text input state (for open_ended and word_cloud)
  const [textAnswer, setTextAnswer] = useState("");
  
  // Jumble state (for puzzle questions) - with drag and drop
  const [jumbleOrder, setJumbleOrder] = useState<number[]>([0, 1, 2, 3]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Load API key from localStorage on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('kahoot_ai_api_key');
    const savedProvider = localStorage.getItem('kahoot_ai_provider') as AIProvider;
    const savedModel = localStorage.getItem('kahoot_ai_model');
    
    if (savedKey) {
      setAiConfig(prev => ({ ...prev, apiKey: savedKey }));
    }
    if (savedProvider && FAST_MODELS[savedProvider]) {
      setAiConfig(prev => ({ ...prev, provider: savedProvider }));
    }
    if (savedModel) {
      setAiConfig(prev => ({ ...prev, model: savedModel }));
    }
  }, []);

  // Save API key to localStorage when changed
  const updateAIConfig = useCallback((updates: Partial<AIConfig>) => {
    setAiConfig(prev => {
      const next = { ...prev, ...updates };
      if (updates.apiKey !== undefined) {
        localStorage.setItem('kahoot_ai_api_key', next.apiKey);
      }
      if (updates.provider !== undefined) {
        localStorage.setItem('kahoot_ai_provider', next.provider);
      }
      if (updates.model !== undefined) {
        localStorage.setItem('kahoot_ai_model', next.model);
      }
      return next;
    });
  }, []);

  // Notification helpers
  const showNotification = useCallback((type: Notification['type'], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);
  
  // SSE connection
  useEffect(() => {
    const eventSource = new EventSource('/api/stream');

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.taskId && taskId && data.taskId !== taskId) return;

            switch (data.type) {
                case 'task_started':
                    setIsRunning(true);
                    setTaskId(data.taskId);
                    setCurrentMode(data.mode || 'takeover');
                    break;
                case 'task_completed':
                case 'task_aborted':
                    setIsRunning(false);
                    setActiveQuestion(null);
                    resetAnswerStates();
                    setAiStatus('idle');
                    setAiError(null);
                    break;
                case 'question_active':
                    setActiveQuestion({
                      type: data.question.type,
                      choiceAmount: data.question.choiceAmount,
                      text: data.question.text,
                      hasImage: data.question.hasImage
                    });
                    resetAnswerStates();
                    setAiStatus(currentMode === 'ai' ? 'thinking' : 'idle');
                    setAiError(null);
                    break;
                case 'question_ended':
                    setActiveQuestion(null);
                    resetAnswerStates();
                    setAiStatus('idle');
                    break;
                case 'ai_error':
                    setAiStatus('error');
                    setAiError({ type: data.errorType, message: data.message });
                    showNotification('error', `AI Error: ${data.message}`);
                    break;
                case 'ai_success':
                    setAiStatus('idle');
                    break;
                case 'log':
                    // Check for AI-related log messages
                    if (data.message?.includes('[AI]')) {
                      if (data.message.includes('Failed') || data.message.includes('error')) {
                        setAiStatus('error');
                      } else if (data.message.includes('Got answer')) {
                        setAiStatus('idle');
                      }
                    }
                    break;
            }
        } catch (err) {}
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, currentMode, showNotification]);

  const resetAnswerStates = () => {
    setSelectedAnswers([]);
    setTextAnswer("");
    setJumbleOrder([0, 1, 2, 3]);
    setDraggedIndex(null);
  };

  const startTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'ai' && !aiConfig.apiKey.trim()) {
      setShowAIConfig(true);
      showNotification('error', 'Please enter an AI API key');
      return;
    }
    
    setIsRunning(true);
    setActiveQuestion(null);
    resetAnswerStates();
    setAiStatus('idle');
    setAiError(null);
    setCurrentMode(mode);

    try {
      const body: any = {
        gamePin,
        nameAlias,
        threads: Number(threads),
        useProxy,
        mode,
        useExactName: useExactName && threads === 1
      };
      
      if (mode === 'ai') {
        body.aiConfig = aiConfig;
      }
      
      const res = await fetch("/api/tasks/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setTaskId(data.taskId);
        showNotification('success', `Deployed ${threads} bots in ${mode} mode`);
      } else {
        throw new Error(data.error || 'Failed to start');
      }
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.message || 'Failed to start task');
      setIsRunning(false);
    }
  };

  const abortTask = async () => {
    if (!taskId) return;
    try {
      await fetch("/api/tasks/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      setIsRunning(false);
      setActiveQuestion(null);
      resetAnswerStates();
      setAiStatus('idle');
      showNotification('info', 'Task aborted');
    } catch (err) {
      console.error(err);
    }
  };

  const submitAnswer = async (answer: number | number[] | string) => {
      if (!taskId) return;
      try {
          await fetch("/api/tasks/answer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId, answerIndex: answer })
          });
      } catch (err) {
          console.error(err);
      }
  };

  // Toggle multi-select answer
  const toggleMultiSelect = (index: number) => {
    setSelectedAnswers(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  // Submit multi-select answers
  const submitMultiSelect = () => {
    if (selectedAnswers.length > 0) {
      submitAnswer(selectedAnswers.sort((a, b) => a - b));
    }
  };

  // Submit text answer (for open_ended and word_cloud)
  const submitTextAnswer = () => {
    if (textAnswer.trim()) {
      submitAnswer(textAnswer.trim());
    }
  };

  // Drag and drop handlers for jumble
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    setJumbleOrder(prev => {
      const newOrder = [...prev];
      [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
      return newOrder;
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleTouchStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const tile = element?.closest('[data-jumble-index]');
    if (tile) {
      const index = parseInt(tile.getAttribute('data-jumble-index') || '-1');
      if (index !== -1 && draggedIndex !== null && draggedIndex !== index) {
        setJumbleOrder(prev => {
          const newOrder = [...prev];
          [newOrder[draggedIndex], newOrder[index]] = [newOrder[index], newOrder[draggedIndex]];
          return newOrder;
        });
        setDraggedIndex(index);
      }
    }
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
  };

  // Submit jumble answer
  const submitJumbleAnswer = () => {
    submitAnswer(jumbleOrder);
  };

  // Get question type display name
  const getQuestionTypeName = (type: string) => {
    const names: Record<string, string> = {
      'quiz': 'Quiz',
      'multiple_select_quiz': 'Multi-Select',
      'multiple_select_poll': 'Multi-Select Poll',
      'open_ended': 'Type Answer',
      'word_cloud': 'Word Cloud',
      'jumble': 'Puzzle',
      'survey': 'Survey',
      'content': 'Content Slide'
    };
    return names[type] || type;
  };

  // Get mode display info
  const getModeInfo = (m: BotMode) => {
    switch (m) {
      case 'auto': return { icon: Bot, label: 'Auto', desc: 'Random answers' };
      case 'ai': return { icon: Brain, label: 'AI', desc: 'LLM powered' };
      case 'takeover': return { icon: Gamepad2, label: 'Manual', desc: 'You control' };
    }
  };

  // Get current provider models
  const currentModels = FAST_MODELS[aiConfig.provider] || FAST_MODELS.openai;

  // Render answer controls based on question type
  const renderAnswerControls = () => {
    if (!activeQuestion) return null;

    const type = activeQuestion.type;

    // Standard Quiz (single choice)
    if (type === 'quiz' || type === 'survey') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <button onClick={() => submitAnswer(0)} className="h-20 sm:h-24 bg-[#e21b3c] hover:bg-[#ff3355] rounded-xl shadow-[0_0_15px_rgba(226,27,60,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 border border-white/20"></button>
          <button onClick={() => submitAnswer(1)} className="h-20 sm:h-24 bg-[#1368ce] hover:bg-[#2b85f0] rounded-xl shadow-[0_0_15px_rgba(19,104,206,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 border border-white/20"></button>
          {(activeQuestion.choiceAmount > 2) && (
            <>
              <button onClick={() => submitAnswer(2)} className="h-20 sm:h-24 bg-[#d89e00] hover:bg-[#ffbe00] rounded-xl shadow-[0_0_15px_rgba(216,158,0,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 border border-white/20"></button>
              <button onClick={() => submitAnswer(3)} className="h-20 sm:h-24 bg-[#26890c] hover:bg-[#33b811] rounded-xl shadow-[0_0_15px_rgba(38,137,12,0.5)] transition-all transform hover:scale-[1.02] active:scale-95 border border-white/20"></button>
            </>
          )}
        </div>
      );
    }

    // Multi-Select Quiz/Poll
    if (type === 'multiple_select_quiz' || type === 'multiple_select_poll') {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[0, 1, 2, 3].map((index) => (
              <button
                key={index}
                onClick={() => toggleMultiSelect(index)}
                className={`h-16 sm:h-20 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 border-2 ${
                  selectedAnswers.includes(index)
                    ? 'border-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-105'
                    : 'border-white/20'
                } ${
                  index === 0 ? 'bg-[#e21b3c] hover:bg-[#ff3355]' :
                  index === 1 ? 'bg-[#1368ce] hover:bg-[#2b85f0]' :
                  index === 2 ? 'bg-[#d89e00] hover:bg-[#ffbe00]' :
                  'bg-[#26890c] hover:bg-[#33b811]'
                }`}
              >
                {selectedAnswers.includes(index) && (
                  <span className="text-white font-bold text-lg sm:text-xl">✓</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={submitMultiSelect}
            disabled={selectedAnswers.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all text-sm sm:text-base"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            Submit ({selectedAnswers.length} selected)
          </button>
        </div>
      );
    }

    // Open Ended / Word Cloud (Text input)
    if (type === 'open_ended' || type === 'word_cloud') {
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 text-neutral-300 mb-2">
            <Type className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <span className="text-xs sm:text-sm">{type === 'word_cloud' ? 'Enter a word or phrase' : 'Type your answer'}</span>
          </div>
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitTextAnswer()}
            placeholder="Enter answer..."
            className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 sm:py-4 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-base sm:text-lg text-center shadow-inner"
            autoFocus
          />
          <button
            onClick={submitTextAnswer}
            disabled={!textAnswer.trim()}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all text-sm sm:text-base"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            Submit Answer
          </button>
        </div>
      );
    }

    // Jumble (Puzzle) - Drag and Drop
    if (type === 'jumble') {
      const colors = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'];
      
      return (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 text-neutral-300 mb-2">
            <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            <span className="text-xs sm:text-sm">Drag to reorder tiles</span>
          </div>
          
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {jumbleOrder.map((item, position) => (
              <div
                key={position}
                data-jumble-index={position}
                draggable
                onDragStart={() => handleDragStart(position)}
                onDragOver={(e) => handleDragOver(e, position)}
                onDragEnd={handleDragEnd}
                onTouchStart={() => handleTouchStart(position)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`cursor-move select-none transition-all duration-200 ${
                  draggedIndex === position ? 'scale-110 z-10' : ''
                }`}
              >
                <div
                  className="w-full h-16 sm:h-20 rounded-xl shadow-lg border-2 border-white/30 flex items-center justify-center"
                  style={{ backgroundColor: colors[item] }}
                >
                  <GripVertical className="w-4 h-4 sm:w-5 sm:h-5 text-white/70 absolute top-1 left-1" />
                  <span className="text-white font-bold text-lg sm:text-xl">{item + 1}</span>
                </div>
                <div className="text-center mt-1">
                  <span className="text-[10px] sm:text-xs text-neutral-400 font-mono">Pos {position + 1}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setJumbleOrder([0, 1, 2, 3])}
              className="px-3 sm:px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg flex items-center gap-1 sm:gap-2 transition-all text-sm"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Reset</span>
            </button>
            <button
              onClick={submitJumbleAnswer}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 sm:py-3 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all text-sm sm:text-base"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              Submit Order
            </button>
          </div>
        </div>
      );
    }

    // Default fallback for unknown types
    return (
      <div className="space-y-3 sm:space-y-4">
        <p className="text-yellow-400 text-xs sm:text-sm text-center">Unknown question type: {type}</p>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {[0, 1, 2, 3].map((index) => (
            <button
              key={index}
              onClick={() => submitAnswer(index)}
              className="h-16 sm:h-20 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-95 border border-white/20 bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-sm sm:text-base"
            >
              Option {index + 1}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen px-3 sm:px-4 py-6 sm:py-12 lg:px-8 max-w-7xl mx-auto flex flex-col gap-6 sm:gap-12">

      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map(n => (
          <div
            key={n.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-in slide-in-from-right ${
              n.type === 'error' ? 'bg-red-900/90 border-red-500/50 text-red-100' :
              n.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/50 text-emerald-100' :
              'bg-blue-900/90 border-blue-500/50 text-blue-100'
            }`}
          >
            {n.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
             n.type === 'success' ? <Check className="w-5 h-5" /> :
             <Zap className="w-5 h-5" />}
            <span className="text-sm">{n.message}</span>
            <button onClick={() => removeNotification(n.id)} className="ml-2 opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <header className="flex flex-col items-center justify-center text-center space-y-3 sm:space-y-4 my-4 sm:my-8 relative z-10">
        <div className="inline-flex items-center justify-center p-2 sm:p-3 bg-purple-500/20 rounded-xl sm:rounded-2xl mb-2 sm:mb-4 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.4)] backdrop-blur-md">
          <Activity className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" />
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-600 font-heading drop-shadow-lg">
          BotZ Network
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-neutral-300 max-w-2xl font-medium drop-shadow-md bg-black/40 px-4 sm:px-6 py-2 rounded-full border border-white/5 backdrop-blur-sm">
          High-performance COMETD HTTP Kahoot Engine.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 relative z-10">

        {/* Left Column: Form & Settings */}
        <section className="lg:col-span-1 space-y-4 sm:space-y-6 order-2 lg:order-1">
          <div className="glass-panel p-4 sm:p-6 bg-black/50 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-2xl">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 flex items-center gap-2 text-white/90">
              <Settings2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              Task Configuration
            </h2>

            <form onSubmit={startTask} className="space-y-4 sm:space-y-5">
              
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-purple-300">Bot Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['auto', 'takeover', 'ai'] as BotMode[]).map((m) => {
                    const { icon: Icon, label } = getModeInfo(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        disabled={isRunning}
                        className={`flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl border transition-all text-xs sm:text-sm font-medium ${
                          mode === m
                            ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                            : 'bg-black/40 border-white/10 text-neutral-400 hover:border-purple-500/30 hover:text-neutral-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] sm:text-xs text-neutral-500">
                  {mode === 'auto' && 'Bots answer automatically with distributed random choices'}
                  {mode === 'takeover' && 'You manually control all bot answers'}
                  {mode === 'ai' && 'AI LLM answers questions intelligently'}
                </p>
              </div>

              {/* AI Configuration */}
              {mode === 'ai' && (
                <div className="space-y-3 p-3 bg-purple-900/10 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-medium text-purple-300 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      AI Configuration
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowAIConfig(!showAIConfig)}
                      className="text-xs text-purple-400 hover:text-purple-300"
                    >
                      {showAIConfig ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  
                  {showAIConfig && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] sm:text-xs text-neutral-400 block mb-1">Provider</label>
                        <select
                          value={aiConfig.provider}
                          onChange={(e) => {
                            const provider = e.target.value as AIProvider;
                            const defaultModel = FAST_MODELS[provider]?.[0]?.id || '';
                            updateAIConfig({ provider, model: defaultModel });
                          }}
                          className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="groq">Groq (Fast)</option>
                          <option value="together">Together AI</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-[10px] sm:text-xs text-neutral-400 block mb-1">
                          Model
                          <span className="ml-2 text-[10px] text-neutral-600">
                            {currentModels.find(m => m.id === aiConfig.model)?.vision && '👁️ Vision'}
                          </span>
                        </label>
                        <select
                          value={aiConfig.model}
                          onChange={(e) => updateAIConfig({ model: e.target.value })}
                          className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                          {currentModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-[10px] sm:text-xs text-neutral-400 block mb-1 flex items-center gap-1">
                          API Key 
                          {aiConfig.apiKey && <Check className="w-3 h-3 text-emerald-500" />}
                        </label>
                        <input
                          type="password"
                          value={aiConfig.apiKey}
                          onChange={(e) => updateAIConfig({ apiKey: e.target.value })}
                          placeholder="sk-..."
                          className="w-full bg-black/60 border border-purple-500/30 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500"
                        />
                        <p className="text-[10px] text-neutral-600 mt-1">Stored locally in your browser</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2 group">
                <label className="text-xs sm:text-sm font-medium text-purple-300 group-focus-within:text-purple-400 transition-colors">Game PIN</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  placeholder="1234567"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-base sm:text-lg font-bold tracking-widest text-center shadow-inner"
                  value={gamePin}
                  onChange={(e) => setGamePin(e.target.value.replace(/\D/g, ''))}
                  disabled={isRunning}
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2 group">
                <label className="text-xs sm:text-sm font-medium text-purple-300 group-focus-within:text-purple-400 transition-colors">Name Alias</label>
                <input
                  type="text"
                  required
                  placeholder="Bot"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-sm shadow-inner"
                  value={nameAlias}
                  onChange={(e) => setNameAlias(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2 group">
                <label className="text-xs sm:text-sm font-medium text-purple-300 group-focus-within:text-purple-400 transition-colors">Bot Count</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-sm shadow-inner"
                  value={threads}
                  onChange={(e) => setThreads(parseInt(e.target.value) || 1)}
                  disabled={isRunning}
                />
              </div>

              {/* Exact Name Toggle - only when threads = 1 */}
              {threads === 1 && (
                <div className="flex items-center gap-3 bg-blue-900/10 p-3 border border-blue-500/20 rounded-xl">
                  <input
                    type="checkbox"
                    id="exact-name-toggle"
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded border-blue-500/30 text-blue-600 focus:ring-blue-500/50 bg-black/50 accent-blue-500 cursor-pointer"
                    checked={useExactName}
                    onChange={(e) => setUseExactName(e.target.checked)}
                    disabled={isRunning}
                  />
                  <label htmlFor="exact-name-toggle" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-white cursor-pointer select-none">
                    <User className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                    Use exact name (no suffix)
                  </label>
                </div>
              )}

              <div className="flex items-center gap-3 bg-purple-900/20 p-3 sm:p-4 border border-purple-500/30 rounded-xl hover:bg-purple-900/30 transition-colors">
                <input
                  type="checkbox"
                  id="proxy-toggle"
                  className="w-4 h-4 sm:w-5 sm:h-5 rounded border-purple-500/30 text-purple-600 focus:ring-purple-500/50 bg-black/50 accent-purple-500 cursor-pointer"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  disabled={isRunning}
                />
                <label htmlFor="proxy-toggle" className="text-xs sm:text-sm font-medium text-white cursor-pointer select-none">
                  Use rotation proxies
                </label>
              </div>

              <div className="pt-2 sm:pt-4">
                {!isRunning ? (
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
                    Deploy Swarm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={abortTask}
                    className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.4)] backdrop-blur-md text-sm sm:text-base"
                  >
                    <Square className="w-4 h-4" fill="currentColor" />
                    Abort
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Mobile-only: Status indicator */}
          <div className="lg:hidden flex items-center justify-center gap-3 bg-black/40 px-4 py-3 rounded-full border border-white/5">
            <span className="relative flex h-3 w-3">
              {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
            </span>
            <span className="text-sm font-mono text-neutral-400">
              {isRunning ? (activeQuestion ? 'Question Active' : 'Connected') : 'Standby'}
            </span>
          </div>
        </section>

        {/* Right Column: Interactive Controller */}
        <section className="lg:col-span-2 space-y-4 sm:space-y-6 flex flex-col h-full order-1 lg:order-2">

          {/* Dynamic Interactive Controller */}
          {isRunning ? (
            <div className={`glass-panel p-4 sm:p-6 bg-black/50 backdrop-blur-xl border rounded-2xl shadow-2xl transition-all duration-500 ${activeQuestion ? 'border-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' : 'border-white/10'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 text-white/90">
                        <MousePointer2 className={`w-4 h-4 sm:w-5 sm:h-5 ${activeQuestion ? 'text-purple-400 animate-pulse' : 'text-neutral-500'}`} />
                        {currentMode === 'takeover' ? 'Interactive Commander' : 
                         currentMode === 'auto' ? 'Auto Mode Active' : 'AI Mode Active'}
                    </h2>
                    {activeQuestion && (
                        <div className="flex items-center gap-2">
                            <span className="px-2 sm:px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-[10px] sm:text-xs font-bold font-mono border border-blue-500/30">
                                {getQuestionTypeName(activeQuestion.type)}
                            </span>
                            {activeQuestion.hasImage && (
                              <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full text-[10px] font-bold border border-purple-500/30">
                                <ImageIcon className="w-3 h-3 inline" />
                              </span>
                            )}
                            {currentMode === 'takeover' && (
                              <span className="hidden sm:inline px-2 sm:px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-[10px] sm:text-xs font-bold font-mono border border-purple-500/30 animate-pulse">
                                  ACTIVE
                              </span>
                            )}
                        </div>
                    )}
                </div>

                {!activeQuestion ? (
                    <div className="h-32 sm:h-40 flex items-center justify-center border-2 border-dashed border-white/10 rounded-xl bg-black/30">
                        <p className="text-neutral-500 font-mono text-xs sm:text-sm animate-pulse">
                          {currentMode === 'auto' ? 'Auto-answering enabled...' :
                           currentMode === 'ai' ? aiStatus === 'thinking' ? 'AI is analyzing...' : 'AI ready...' :
                           'Waiting for question...'}
                        </p>
                    </div>
                ) : (
                    <div className="py-1 sm:py-2">
                        {currentMode === 'takeover' ? renderAnswerControls() : (
                          <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-4 ${
                              aiStatus === 'thinking' ? 'animate-pulse bg-purple-500/20' :
                              aiStatus === 'error' ? 'bg-red-500/20' :
                              'bg-purple-500/10'
                            }`}>
                              {currentMode === 'auto' ? <Bot className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400" /> :
                               aiStatus === 'error' ? <AlertCircle className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" /> :
                               <Brain className={`w-8 h-8 sm:w-10 sm:h-10 ${aiStatus === 'thinking' ? 'text-purple-400 animate-pulse' : 'text-purple-400'}`} />}
                            </div>
                            <h3 className="text-lg sm:text-xl font-semibold text-white/80 mb-2">
                              {currentMode === 'auto' ? 'Auto Mode' : 
                               aiStatus === 'thinking' ? 'AI Thinking...' :
                               aiStatus === 'error' ? 'AI Error' : 'AI Mode'}
                            </h3>
                            <p className="text-sm text-neutral-500 max-w-xs">
                              {currentMode === 'auto' 
                                ? 'Bots are automatically answering with distributed random choices.' 
                                : aiStatus === 'thinking'
                                  ? 'AI is analyzing the question and determining the best answer...'
                                  : aiStatus === 'error'
                                    ? aiError?.message || 'AI encountered an error. Falling back to random answers.'
                                    : 'AI is monitoring questions and will answer intelligently.'}
                            </p>
                            {currentMode === 'ai' && activeQuestion?.hasImage && (
                              <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                Image question detected - using vision
                              </p>
                            )}
                          </div>
                        )}
                    </div>
                )}
            </div>
          ) : (
            /* Not running state */
            <div className="glass-panel p-6 sm:p-12 bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col items-center justify-center text-center min-h-[200px] sm:min-h-[300px]">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
                <MousePointer2 className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400/50" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white/80 mb-2">Controller Ready</h3>
              <p className="text-sm text-neutral-500 max-w-xs">
                Select a mode and configure settings to start controlling Kahoot questions.
              </p>
            </div>
          )}

          {/* Desktop-only: Status bar */}
          <div className="hidden lg:flex items-center justify-between bg-black/40 px-4 py-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-emerald-500' : 'bg-neutral-600'}`}></span>
              </span>
              <span className="text-sm font-mono text-neutral-400">
                {isRunning ? `System Active (${currentMode})` : 'System Standby'}
              </span>
            </div>
            {isRunning && taskId && (
              <span className="text-xs font-mono text-neutral-500 truncate max-w-[200px]">
                Task: {taskId.slice(0, 8)}...
              </span>
            )}
          </div>

        </section>

      </div>
    </main>
  );
}
