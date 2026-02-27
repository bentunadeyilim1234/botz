import { Activity } from "lucide-react";

export default function FAQ() {
    return (
        <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col gap-12">
            <header className="flex flex-col items-center justify-center text-center space-y-4 my-8">
                <div className="inline-flex items-center justify-center p-3 bg-purple-500/20 rounded-2xl mb-4 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    <Activity className="w-10 h-10 text-purple-400" />
                </div>
                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-600 font-heading">
                    FAQ
                </h1>
            </header>

            <div className="space-y-6">
                <div className="glass-panel p-6 border border-white/5 rounded-xl bg-black/60">
                    <h3 className="text-xl font-bold text-white mb-2">How does the bot work?</h3>
                    <p className="text-neutral-400">
                        K-Botter uses headless Playwright instances to simulate actual users. It securely joins your specified Kahoot session, bypasses standard bot protections, and randomly answers questions correctly to ensure it looks like a real participant.
                    </p>
                </div>
                <div className="glass-panel p-6 border border-white/5 rounded-xl bg-black/60">
                    <h3 className="text-xl font-bold text-white mb-2">What is the "Use Proxy" feature?</h3>
                    <p className="text-neutral-400">
                        When enabled, the bot will route its traffic through our built-in high-quality residential and datacenter proxies. This masks the IP address of each bot instance, preventing Kahoot from banning your session due to too many connections from a single IP.
                    </p>
                </div>
                <div className="glass-panel p-6 border border-white/5 rounded-xl bg-black/60">
                    <h3 className="text-xl font-bold text-white mb-2">Is there a limit to how many bots I can add?</h3>
                    <p className="text-neutral-400">
                        The script is optimized to handle massive concurrency. You can safely launch hundreds of bots at once depending on the internal resources (RAM/CPU) of your hosting machine. K-Botter blocks resources like images and fonts to keep RAM usage exceptionally low.
                    </p>
                </div>
            </div>
        </main>
    );
}
