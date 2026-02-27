"use client";

import { useState, useEffect } from "react";
import { Play, Square, Settings2, Activity, Terminal } from "lucide-react";

export default function Home() {
  const [gamePin, setGamePin] = useState("");
  const [nameAlias, setNameAlias] = useState("");
  const [threads, setThreads] = useState(1);
  const [useProxy, setUseProxy] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [serverState, setServerState] = useState<any>({});

  // Real-time WebSocket connection to Fastify
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3001/ws/status");
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "statusUpdate") {
          setServerState(msg.data);
        }
      } catch (err) { }
    };
    return () => {
      ws.close();
    };
  }, []);

  // Sync isRunning flag from server state
  useEffect(() => {
    if (taskId && serverState[taskId]) {
      const status = serverState[taskId].status;
      if (status === 'completed' || status === 'aborted') {
        setIsRunning(false);
      } else {
        setIsRunning(true);
      }
    }
  }, [serverState, taskId]);

  const startTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRunning(true);

    try {
      const res = await fetch("http://localhost:3001/api/tasks/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamePin, nameAlias, threads: Number(threads), useProxy })
      });
      const data = await res.json();
      if (data.success) {
        setTaskId(data.taskId);
      }
    } catch (err) {
      console.error(err);
      setIsRunning(false);
    }
  };

  const abortTask = async () => {
    if (!taskId) return;
    try {
      await fetch("http://localhost:3001/api/tasks/abort", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      setIsRunning(false);
    } catch (err) {
      console.error(err);
    }
  };

  const currentTask = taskId ? serverState[taskId] : null;

  return (
    <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-12">

      {/* Header Section */}
      <header className="flex flex-col items-center justify-center text-center space-y-4 my-8">
        <div className="inline-flex items-center justify-center p-3 bg-purple-500/20 rounded-2xl mb-4 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
          <Activity className="w-10 h-10 text-purple-400" />
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-600 font-heading">
          K-Botter.
        </h1>
        <p className="text-lg md:text-xl text-neutral-300 max-w-2xl font-medium">
          High-performance, threaded Playwright execution engine.
          Join any session, instantly and securely.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Form & Settings */}
        <section className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-white/90">
              <Settings2 className="w-5 h-5 text-blue-400" />
              Task Configuration
            </h2>

            <form onSubmit={startTask} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-purple-300">Target URL</label>
                <input
                  type="text"
                  required
                  placeholder="1234567"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-lg font-bold tracking-widest text-center"
                  value={gamePin}
                  onChange={(e) => setGamePin(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-purple-300">Name Alias</label>
                <input
                  type="text"
                  required
                  placeholder="Bot"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-sm"
                  value={nameAlias}
                  onChange={(e) => setNameAlias(e.target.value)}
                  disabled={isRunning}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-purple-300">Concurrent Threads</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  className="w-full bg-black/60 border border-purple-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/70 focus:border-purple-500/70 transition-all font-mono text-sm"
                  value={threads}
                  onChange={(e) => setThreads(parseInt(e.target.value))}
                  disabled={isRunning}
                />
              </div>

              <div className="flex items-center gap-3 bg-purple-900/10 p-4 border border-purple-500/20 rounded-xl">
                <input
                  type="checkbox"
                  id="proxy-toggle"
                  className="w-5 h-5 rounded border-purple-500/30 text-purple-600 focus:ring-purple-500/50 bg-black/50 accent-purple-500 cursor-pointer"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  disabled={isRunning}
                />
                <label htmlFor="proxy-toggle" className="text-sm font-medium text-white cursor-pointer select-none">
                  Use built-in rotation proxies (Anti-ban)
                </label>
              </div>

              {/* Toggles could go here for session keeping, random clicks etc */}

              <div className="pt-4">
                {!isRunning ? (
                  <button
                    type="submit"
                    className="glass-button w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all hover:shadow-[0_0_30px_rgba(168,85,247,0.6)]"
                  >
                    <Play className="w-5 h-5" fill="currentColor" />
                    Join Game
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={abortTask}
                    className="glass-button w-full bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    <Square className="w-4 h-4" fill="currentColor" />
                    Abort Task
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Ad Space Left */}
          <div className="glass-panel p-4 flex flex-col justify-center items-center min-h-[250px] border-dashed border-white/5 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900/50 to-neutral-900/80 -z-10" />
            <p className="text-xs uppercase tracking-widest text-neutral-600 font-bold mb-2">Advertisement</p>
            <div className="w-full h-full bg-neutral-900/50 rounded-lg flex items-center justify-center border border-neutral-800 transition-colors group-hover:border-neutral-700">
              <span className="text-neutral-500 text-sm">Ad Space Available</span>
            </div>
          </div>
        </section>

        {/* Right Column: Status & Logs */}
        <section className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 h-full flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-white/90">
                <Terminal className="w-5 h-5 text-emerald-400" />
                Live Execution Logs
              </h2>

              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isRunning ? 'bg-purple-500' : 'bg-neutral-600'}`}></span>
                </span>
                <span className="text-sm font-mono text-neutral-400">
                  {isRunning ? 'System Active' : currentTask?.status === 'completed' ? 'Task Completed' : 'System Standby'}
                </span>
              </div>
            </div>

            <div className="flex-1 bg-black/60 border border-white/5 rounded-xl p-4 font-mono text-sm overflow-y-auto w-full relative h-[400px] max-h-[400px]">
              {(!taskId || !currentTask) ? (
                <div className="absolute inset-0 flex items-center justify-center text-neutral-600">
                  Awaiting task submission...
                </div>
              ) : (
                <div className="space-y-2 flex flex-col justify-end h-full">
                  {currentTask.logs.slice(-20).map((log: string, idx: number) => (
                    <div key={idx} className={`${log.includes('error') || log.includes('Runtime error') || log.includes('Intercept') ? 'text-red-400' : log.includes('Success') || log.includes('completed') ? 'text-emerald-400' : 'text-neutral-300'}`}>
                      {log}
                    </div>
                  ))}
                  {isRunning && (
                    <div className="text-blue-400 animate-pulse mt-2">_</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

      </div>

      {/* Banner Ad Space Bottom */}
      <div className="glass-panel w-full p-4 flex flex-col justify-center items-center min-h-[120px] border-dashed border-white/5 relative overflow-hidden mt-8 group">
        <p className="text-xs uppercase tracking-widest text-neutral-600 font-bold mb-2">Advertisement</p>
        <div className="w-full h-full max-w-4xl bg-neutral-900/50 rounded-lg flex items-center justify-center border border-neutral-800 transition-colors group-hover:border-neutral-700 cursor-pointer">
          <span className="text-neutral-500 text-sm">Premium Ad Space (728x90)</span>
        </div>
      </div>

    </main>
  );
}
