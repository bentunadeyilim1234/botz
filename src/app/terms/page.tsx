export default function Terms() {
    return (
        <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col gap-12 text-neutral-300">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-600 mb-4">
                    Terms of Service
                </h1>
                <p className="text-sm text-neutral-500">Last updated: Today</p>
            </header>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-white">1. Educational Purpose</h2>
                <p>
                    K-Botter is provided strictly for educational and testing purposes. Do not use this software to disrupt class environments, malicious attacks, or cause platform degradation.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8">2. Liability</h2>
                <p>
                    You are solely responsible for your actions while using K-Botter. The creators assume no liability for potential bans, damages, or consequences resulting from the misuse of this tool.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8">3. Acceptable Use</h2>
                <p>
                    Please keep thread limits reasonable to avoid stressing third-party servers. We encourage responsible automation testing on your own hosted game sessions.
                </p>
            </section>
        </main>
    );
}
