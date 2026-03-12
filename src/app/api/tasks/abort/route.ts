export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AutomationEngine } from '../../engine';

const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;

export async function POST(req: Request) {
    try {
        const { taskId } = await req.json();

        if (!taskId) return NextResponse.json({ error: 'TaskId required' }, { status: 400 });

        engine.emit({ type: 'log', taskId, message: `[${new Date().toLocaleTimeString()}] System intercept received. Terminating bots...` });
        
        await engine.abortTask(taskId);

        engine.emit({ type: 'task_aborted', taskId });
        
        return NextResponse.json({ success: true, message: 'Task aborted.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
