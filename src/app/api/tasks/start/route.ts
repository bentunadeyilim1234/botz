import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { AutomationEngine, TaskConfig } from '../../engine';

// Note: maxDuration is configured in vercel.json
// Store instance globally per-worker 
const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;
export async function POST(req: Request) {
    try {
        const { gamePin, nameAlias, threads, useProxy, mode, useExactName, aiConfig } = await req.json();
        const taskId = crypto.randomUUID();

        // Build task configuration
        const config: TaskConfig = {
            mode: mode || 'takeover',
            useExactName: useExactName === true,
            aiConfig: aiConfig
        };

        // Start the engine runTask asynchronously
        const logCallback = (msg: string) => {
             engine.emit({ type: 'log', taskId, message: `[${new Date().toLocaleTimeString()}] ${msg}` });
        };

        engine.runTask(
            taskId, 
            gamePin, 
            nameAlias, 
            parseInt(threads) || 1, 
            useProxy === true, 
            config,
            logCallback
        ).then(() => {
             engine.emit({ type: 'task_completed', taskId });
        }).catch((err) => {
             engine.emit({ type: 'task_error', taskId, error: err.message });
        });

        // Initialize state event
        setTimeout(() => {
             engine.emit({ 
                type: 'task_started', 
                taskId, 
                gamePin, 
                nameAlias, 
                threads, 
                useProxy,
                mode: config.mode,
                useExactName: config.useExactName
            });
        }, 500);

        return NextResponse.json({ success: true, taskId, mode: config.mode });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
