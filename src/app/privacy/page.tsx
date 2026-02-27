export default function Privacy() {
    return (
        <main className="min-h-screen px-4 py-12 sm:px-6 lg:px-8 max-w-4xl mx-auto flex flex-col gap-12 text-neutral-300">
            <header className="mb-8">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-purple-200 to-purple-600 mb-4">
                    Privacy Policy
                </h1>
                <p className="text-sm text-neutral-500">Last updated: Today</p>
            </header>

            <section className="space-y-4">
                <h2 className="text-2xl font-bold text-white">1. Information Collection</h2>
                <p>
                    We do not collect, store, or process any personal information. All botting activities are run entirely locally or on your self-hosted server instance.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8">2. Third-Party Services</h2>
                <p>
                    K-Botter interacts directly with Kahoot's services. Your IP address or the IP addresses of your configured proxies will be exposed to Kahoot's servers during operation. We are not responsible for how Kahoot handles this information.
                </p>

                <h2 className="text-2xl font-bold text-white mt-8">3. Cookies & Tracking</h2>
                <p>
                    We use zero tracking and zero cookies on the K-Botter platform.
                </p>
            </section>
        </main>
    );
}
