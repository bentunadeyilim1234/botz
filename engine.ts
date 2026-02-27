import { chromium, Browser, BrowserContext } from 'playwright';

export class AutomationEngine {
    private browser: Browser | null = null;
    // Map taskId -> array of contexts for precise cleanup
    private activeContexts: Map<string, BrowserContext[]> = new Map();
    private abortSignals: Map<string, AbortController> = new Map();

    private defaultProxies: string[] = [
        // Replace with actual proxies provided by user when ready, or hardcode valid ones here
        // format: http://username:password@ip:port or http://ip:port
        "http://your-proxy-domain.com:8000"
    ];

    constructor() { }

    async init() {
        if (!this.browser) {
            // Launch a single browser instance to minimize RAM usage.
            this.browser = await chromium.launch({ headless: true });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async runTask(taskId: string, gamePin: string, nameAlias: string, threads: number, useProxy: boolean, logCallback: (msg: string) => void) {
        if (!this.browser) await this.init();

        const abortController = new AbortController();
        this.abortSignals.set(taskId, abortController);
        this.activeContexts.set(taskId, []);

        logCallback(`[Engine] Spawning ${threads} browser contexts...`);

        // Automatically abort task after 10 minutes
        const timeoutId = setTimeout(() => {
            logCallback(`[Engine] 10-minute timeout reached. Automatically aborting task...`);
            this.abortTask(taskId);
        }, 10 * 60 * 1000);

        const promises = [];
        for (let i = 0; i < threads; i++) {
            promises.push(this.runSingleThread(taskId, gamePin, nameAlias, i + 1, useProxy, logCallback, abortController.signal));
            // Stagger start to avoid skyrocketing CPU usage simultaneously
            await new Promise(r => setTimeout(r, 100));
        }

        try {
            await Promise.allSettled(promises);
            logCallback(`[Engine] All execution threads completed for task.`);
        } finally {
            clearTimeout(timeoutId);
            this.abortSignals.delete(taskId);
            this.activeContexts.delete(taskId);
        }
    }

    private async runSingleThread(taskId: string, gamePin: string, nameAlias: string, threadIndex: number, useProxy: boolean, logCallback: (msg: string) => void, signal: AbortSignal) {
        if (!this.browser) return;

        let context: BrowserContext | null = null;
        try {
            const contextOptions: any = {};
            if (useProxy && this.defaultProxies.length > 0) {
                const proxyUrl = this.defaultProxies[threadIndex % this.defaultProxies.length];
                contextOptions.proxy = { server: proxyUrl };
                logCallback(`[Thread ${threadIndex}] Assigned proxy...`);
            }

            context = await this.browser.newContext(contextOptions);

            // Add context to array for precise abort capabilities
            const taskContexts = this.activeContexts.get(taskId);
            if (taskContexts) taskContexts.push(context);

            // Block massive resources to optimize memory/CPU for 100+ threads
            await context.route('**/*', route => {
                const resourceType = route.request().resourceType();
                if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            const page = await context.newPage();

            logCallback(`[Thread ${threadIndex}] Routing to kahoot.it...`);

            // Timeout is short because bots should fail fast
            await page.goto("https://kahoot.it", { waitUntil: 'domcontentloaded', timeout: 30000 });

            if (signal.aborted) throw new Error('Aborted');

            // Wait for Game PIN input and submit
            logCallback(`[Thread ${threadIndex}] Entering Game PIN...`);
            const pinInput = page.getByPlaceholder(/game pin/i);
            await pinInput.waitFor({ state: 'visible', timeout: 15000 });
            await pinInput.fill(gamePin);
            await pinInput.press('Enter');

            if (signal.aborted) throw new Error('Aborted');

            // Wait for Nickname input and submit
            logCallback(`[Thread ${threadIndex}] Entering Nickname...`);
            const nicknameInput = page.getByPlaceholder(/nickname/i);
            await nicknameInput.waitFor({ state: 'visible', timeout: 15000 });

            // Append random characters
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let randomSuffix = '';
            for (let i = 0; i < 4; i++) {
                randomSuffix += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const finalUsername = `${nameAlias}-${randomSuffix}`;

            await nicknameInput.fill(finalUsername);
            await nicknameInput.press('Enter');

            if (signal.aborted) throw new Error('Aborted');

            logCallback(`[Thread ${threadIndex}] Joined as ${finalUsername}. Waiting for questions...`);

            // Infinite loop to click answers
            while (!signal.aborted) {
                try {
                    // Try to find answer buttons. Kahoot answer buttons often have specific functional selectors
                    // This prevents clicking random UI buttons like "Jump to main content"
                    const btnLocators = [
                        page.locator('[data-functional-selector^="question-choice"]'),
                        page.locator('[data-functional-selector^="answer-"]'),
                        page.locator('[data-functional-selector^="multi-choice"]'),
                        page.locator('[data-functional-selector^="true-false"]')
                    ];

                    let clicked = false;
                    for (const locator of btnLocators) {
                        const count = await locator.count();
                        if (count > 0 && count <= 6) { // Filter out non-answer buttons (usually 2 to 4 choices)
                            const visibleIndices = [];
                            for (let i = 0; i < count; i++) {
                                if (await locator.nth(i).isVisible()) {
                                    visibleIndices.push(i);
                                }
                            }

                            if (visibleIndices.length > 0) {
                                const randomIdx = visibleIndices[Math.floor(Math.random() * visibleIndices.length)];
                                await locator.nth(randomIdx).click({ timeout: 2000 });
                                logCallback(`[Thread ${threadIndex}] Selected an answer.`);

                                // Sleep 3 seconds after clicking to avoid spamming the same question
                                await new Promise(res => setTimeout(res, 3000));
                                clicked = true;
                                break;
                            }
                        }
                    }
                    if (clicked) continue;
                } catch (e) {
                    // Ignore transient errors like timeout on clicking invisible button
                }

                // Sleep slightly to check for next question
                await new Promise(res => setTimeout(res, 500 + Math.random() * 500));
            }

            if (signal.aborted) throw new Error('Aborted');
            logCallback(`[Thread ${threadIndex}] Success. Terminating context.`);

        } catch (err: any) {
            if (err.message === 'Aborted') {
                logCallback(`[Thread ${threadIndex}] Halted due to user intercept.`);
            } else {
                logCallback(`[Thread ${threadIndex}] Runtime error: ${err.message}`);
            }
        } finally {
            if (context) await context.close();
        }
    }

    async abortTask(taskId: string) {
        // Flag the abort signal so async yields will throw
        const signal = this.abortSignals.get(taskId);
        if (signal) {
            signal.abort();
        }

        // Force close all contexts associated with this task
        const contexts = this.activeContexts.get(taskId);
        if (contexts) {
            for (const ctx of contexts) {
                await ctx.close().catch(() => { });
            }
        }

        this.activeContexts.delete(taskId);
        this.abortSignals.delete(taskId);
    }
}

export const engine = new AutomationEngine();
