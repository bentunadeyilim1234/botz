export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AutomationEngine } from '../../engine';

const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;

export async function POST(req: Request) {
    try {
        const { taskId, answerIndex } = await req.json();

        if (!taskId || answerIndex === undefined) return NextResponse.json({ error: 'TaskId and answerIndex required' }, { status: 400 });

        // Format log message based on answer type
        let logMessage: string;
        if (typeof answerIndex === 'string') {
            logMessage = `[${new Date().toLocaleTimeString()}] Commanding all bots to submit text answer...`;
        } else if (Array.isArray(answerIndex)) {
            logMessage = `[${new Date().toLocaleTimeString()}] Commanding all bots to submit array: [${answerIndex.join(', ')}]...`;
        } else {
            logMessage = `[${new Date().toLocaleTimeString()}] Commanding all bots to submit Option ${Number(answerIndex) + 1}...`;
        }

        engine.emit({ type: 'log', taskId, message: logMessage });
        
        const success = await engine.answerTask(taskId, answerIndex);
        
        if (success) {
            engine.emit({ type: 'log', taskId, message: `[${new Date().toLocaleTimeString()}] Successfully transmitted answer to swarm.` });
            return NextResponse.json({ success: true, message: 'Answers submitted.' });
        } else {
             return NextResponse.json({ error: 'Task not found or no active clients' }, { status: 404 });
        }
        
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
