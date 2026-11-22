<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ config('app.name', 'stoqio') }} API</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #f6f8fb;
            --panel: #ffffff;
            --ink: #172033;
            --muted: #667085;
            --line: #dbe3ef;
            --brand: #0f766e;
            --brand-dark: #115e59;
            --ok-bg: #e8f7f1;
            --ok: #047857;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            background: var(--bg);
            color: var(--ink);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        main {
            width: min(960px, calc(100% - 32px));
            min-height: 100vh;
            margin: 0 auto;
            display: grid;
            align-content: center;
            gap: 20px;
            padding: 48px 0;
        }

        .shell {
            background: var(--panel);
            border: 1px solid var(--line);
            border-radius: 8px;
            box-shadow: 0 18px 45px rgba(23, 32, 51, 0.08);
            overflow: hidden;
        }

        .hero {
            display: grid;
            gap: 18px;
            padding: 36px;
            border-bottom: 1px solid var(--line);
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 12px;
            font-weight: 800;
            letter-spacing: 0;
            font-size: 20px;
        }

        .mark {
            width: 42px;
            height: 42px;
            border-radius: 8px;
            display: grid;
            place-items: center;
            color: #fff;
            background: var(--brand);
            font-weight: 900;
        }

        h1 {
            max-width: 720px;
            margin: 0;
            font-size: clamp(32px, 5vw, 54px);
            line-height: 1.02;
            letter-spacing: 0;
        }

        p {
            max-width: 680px;
            margin: 0;
            color: var(--muted);
            font-size: 16px;
            line-height: 1.7;
        }

        .status {
            display: inline-flex;
            width: fit-content;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--ok-bg);
            color: var(--ok);
            font-weight: 700;
            font-size: 14px;
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0;
        }

        .item {
            min-height: 170px;
            padding: 28px;
            border-right: 1px solid var(--line);
        }

        .item:last-child {
            border-right: 0;
        }

        .item h2 {
            margin: 0 0 10px;
            font-size: 17px;
            letter-spacing: 0;
        }

        .item p {
            font-size: 14px;
            line-height: 1.6;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 6px;
        }

        a.button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 42px;
            padding: 0 16px;
            border-radius: 6px;
            background: var(--brand);
            color: #fff;
            text-decoration: none;
            font-weight: 800;
            font-size: 14px;
        }

        a.button.secondary {
            background: #eef3f8;
            color: var(--brand-dark);
        }

        code {
            padding: 2px 6px;
            border-radius: 4px;
            background: #eef3f8;
            color: #344054;
            font-size: 13px;
        }

        footer {
            color: var(--muted);
            font-size: 13px;
            text-align: center;
        }

        @media (max-width: 760px) {
            .hero {
                padding: 26px;
            }

            .grid {
                grid-template-columns: 1fr;
            }

            .item {
                min-height: auto;
                border-right: 0;
                border-bottom: 1px solid var(--line);
            }

            .item:last-child {
                border-bottom: 0;
            }
        }
    </style>
</head>
<body>
    <main>
        <section class="shell" aria-labelledby="page-title">
            <div class="hero">
                <div class="brand">
                    <div class="mark">N</div>
                    <span>{{ config('app.name', 'stoqio') }}</span>
                </div>

                <div class="status"><span class="dot"></span> Backend API is running</div>

                <h1 id="page-title">stoqio API backend is ready.</h1>
                <p>
                    This backend installation powers the stoqio web, inventory, POS, warehouse, billing,
                    and backoffice features through the versioned API. Connect the React frontend to this
                    backend using the configured API base URL.
                </p>

                <div class="actions">
                    <a class="button" href="{{ url('/api/v1/install-status') }}">Check Install Status</a>
                    <a class="button secondary" href="{{ url('/api/v1') }}">Open API Base</a>
                </div>
            </div>

            <div class="grid">
                <article class="item">
                    <h2>API Base URL</h2>
                    <p>Use <code>{{ url('/api/v1') }}</code> in the frontend configuration and mobile clients.</p>
                </article>

                <article class="item">
                    <h2>Frontend Setup</h2>
                    <p>Build or host the included React application from <code>NexstockWeb</code> and point it to this backend.</p>
                </article>

                <article class="item">
                    <h2>Documentation</h2>
                    <p>Review the included documentation folder for installation, deployment, API, and maintenance guidance.</p>
                </article>
            </div>
        </section>

        <footer>
            {{ config('app.name', 'stoqio') }} Backend
        </footer>
    </main>
</body>
</html>
