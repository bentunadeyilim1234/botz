import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { engine } from './engine';
import crypto from 'crypto';

const fastify = Fastify({
    logger: true,
});

fastify.register(cors, {
    origin: '*',
});

fastify.register(websocket);

// State tracking
const activeTasks = new Map();

// REST API Route: Start a Task
fastify.post('/api/tasks/start', async (request, reply) => {
    const { gamePin, nameAlias, threads, useProxy } = request.body as any;
    const taskId = crypto.randomUUID();

    activeTasks.set(taskId, {
        status: 'running',
        gamePin,
        nameAlias,
        threads,
        useProxy,
        logs: [`[${new Date().toLocaleTimeString()}] System received payload. Initializing task ${taskId} with ${threads} threads...`]
    });

    const logCallback = (msg: string) => {
        const t = activeTasks.get(taskId);
        if (t) t.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    };

    // Run async without blocking the response
    engine.runTask(taskId, gamePin, nameAlias, parseInt(threads) || 1, useProxy === true, logCallback).then(() => {
        const t = activeTasks.get(taskId);
        if (t && t.status !== 'aborted') t.status = 'completed';
    });

    return reply.send({ success: true, taskId });
});

// REST API Route: Abort a Task
fastify.post('/api/tasks/abort', async (request, reply) => {
    const { taskId } = request.body as any;

    if (activeTasks.has(taskId)) {
        const task = activeTasks.get(taskId);
        task.status = 'aborted';
        task.logs.push(`[${new Date().toLocaleTimeString()}] System intercept received. Terminating playwright contexts...`);

        await engine.abortTask(taskId);

        task.logs.push(`[${new Date().toLocaleTimeString()}] All threads successfully terminated.`);
        return reply.send({ success: true, message: 'Task aborted.' });
    }

    return reply.status(404).send({ error: 'Task not found' });
});

// WebSocket Route: Stream Execution Status
fastify.register(async function (fastify) {
    fastify.get('/ws/status', { websocket: true }, (connection, req) => {

        const interval = setInterval(() => {
            const stateObj = Object.fromEntries(activeTasks);
            connection.send(JSON.stringify({ type: 'statusUpdate', data: stateObj }));
        }, 500);

        connection.on('close', () => {
            clearInterval(interval);
        });

    });
});

// Start Server
const start = async () => {
    try {
        await engine.init();
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        fastify.log.info(`Server listening on ${fastify.server.address()}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
