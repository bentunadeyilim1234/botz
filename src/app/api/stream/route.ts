import { NextRequest } from 'next/server';
import { AutomationEngine } from '../engine';

export const dynamic = 'force-dynamic';

const globalForEngine = global as unknown as { engine: AutomationEngine };
const engine = globalForEngine.engine || new AutomationEngine();
if (process.env.NODE_ENV !== "production") globalForEngine.engine = engine;

export async function GET(req: NextRequest) {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
        start(controller) {
            let isClosed = false;
            
            // Safe enqueue that checks if stream is still open
            const safeEnqueue = (data: string) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(data));
                } catch(e) {
                    isClosed = true;
                }
            };
            
            // Listener function wrapper
            const onEvent = (event: any) => {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                safeEnqueue(data);
            };

            // Register subscriber
            const removeListener = engine.addEventListener(onEvent);

            // Send initial connection message
            safeEnqueue(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

            // Send ping every 15s to keep connection alive
            // On Vercel, functions have execution time limits, so we keep the interval
            // but the connection will naturally close when the function times out
            const interval = setInterval(() => {
                safeEnqueue(': ping\n\n');
            }, 15000);

            // Handle client disconnect
            req.signal.addEventListener('abort', () => {
                isClosed = true;
                clearInterval(interval);
                removeListener();
                try {
                    controller.close();
                } catch (e) {
                    // Already closed
                }
            });
            
            // Vercel serverless functions have execution limits
            // Hobby: 10 seconds, Pro: 5 minutes
            // We gracefully close the stream before timeout to prevent errors
            const isVercel = process.env.VERCEL === '1';
            const executionLimit = process.env.VERCEL_REGION ? 25000 : 290000; // 25s or ~5min (with buffer)
            
            if (isVercel) {
                setTimeout(() => {
                    if (!isClosed) {
                        safeEnqueue(`data: ${JSON.stringify({ type: 'reconnect', reason: 'timeout' })}\n\n`);
                        isClosed = true;
                        clearInterval(interval);
                        removeListener();
                        try {
                            controller.close();
                        } catch (e) {}
                    }
                }, executionLimit);
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    });
}
