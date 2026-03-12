export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { AutomationEngine } from '../engine';

const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;

// This endpoint is called by Vercel Cron to keep the app warm
export async function GET() {
    // Emit a ping event to keep connections alive
    engine.emit({ type: 'ping', timestamp: Date.now() });
    
    return NextResponse.json({ 
        success: true, 
        status: 'pong',
        timestamp: new Date().toISOString()
    });
}

// Also support POST for flexibility
export async function POST() {
    return GET();
}
