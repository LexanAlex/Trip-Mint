const crypto = require('crypto');

const memory = {
  contacts: [],
  purchases: []
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(body);
}

function htmlResponse(res, body) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.end(body);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        try {
          resolve(JSON.parse(req.body));
        } catch (err) {
          resolve(req.body);
        }
        return;
      }

      if (Buffer.isBuffer(req.body)) {
        try {
          resolve(JSON.parse(req.body.toString('utf8')));
        } catch (err) {
          resolve(req.body.toString('utf8'));
        }
        return;
      }

      resolve(req.body);
      return;
    }

    let raw = '';

    req.on('data', function (chunk) {
      raw += chunk;
    });

    req.on('end', function () {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        resolve(raw);
      }
    });

    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise(function (resolve, reject) {
    if (typeof req.body === 'string') {
      resolve(req.body);
      return;
    }

    if (req.body && Buffer.isBuffer(req.body)) {
      resolve(req.body.toString('utf8'));
      return;
    }

    if (req.body && typeof req.body === 'object') {
      resolve(JSON.stringify(req.body));
      return;
    }

    let raw = '';

    req.on('data', function (chunk) {
      raw += chunk;
    });

    req.on('end', function () {
      resolve(raw || '{}');
    });

    req.on('error', reject);
  });
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function clampText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function trimList(list, max) {
  if (list.length > max) {
    list.length = max;
  }
}

function getBase(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  return proto + '://' + host;
}

function getPaymentReadiness() {
  const publicKey = process.env.PAYSTACK_PUBLIC_KEY || '';
  const secretKey = process.env.PAYSTACK_SECRET_KEY || '';
  const merchantApproved = String(process.env.PAYSTACK_MERCHANT_APPROVED || 'true').toLowerCase() === 'true';
  const mode = process.env.PAYSTACK_MODE === 'live' ? 'live' : 'test';

  return {
    publicKey: publicKey,
    secretKey: secretKey,
    merchantApproved: merchantApproved,
    mode: mode,
    ready: Boolean(publicKey && secretKey && merchantApproved)
  };
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TripMint | A day that works</title>
  <meta name="description" content="Practical one-day travel decisions, source-led destination research, and guides designed to make limited time feel clear.">
  <style>
    :root {
      --bg: #061d26;
      --panel: #082831;
      --panel-2: #06222c;
      --text: #f6f1e7;
      --muted: rgba(246, 241, 231, 0.68);
      --accent: #58ded7;
      --orange: #f07945;
      --line: rgba(255, 255, 255, 0.12);
      --shadow: 0 20px 60px rgba(0, 0, 0, 0.22);
      --radius: 24px;
    }

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(88, 222, 215, 0.14), transparent 30%),
        radial-gradient(circle at top right, rgba(240, 121, 69, 0.12), transparent 24%),
        var(--bg);
      color: var(--text);
      line-height: 1.55;
    }

    body.no-scroll { overflow: hidden; }

    a { color: inherit; }
    button, input, select, textarea { font: inherit; }

    .container {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
    }

    .skip {
      position: absolute;
      left: -9999px;
      top: 0;
      z-index: 999;
      background: #fff;
      color: #000;
      padding: 10px 14px;
      border-radius: 10px;
    }

    .skip:focus { left: 12px; top: 12px; }

    .site-header {
      position: sticky;
      top: 0;
      z-index: 60;
      backdrop-filter: blur(16px);
      background: rgba(6, 29, 38, 0.82);
      border-bottom: 1px solid var(--line);
    }

    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 14px 0;
    }

    .brand {
      font-weight: 800;
      letter-spacing: 0.02em;
      text-decoration: none;
      font-size: 18px;
    }

    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .nav-links button {
      background: transparent;
      color: rgba(246, 241, 231, 0.76);
      border: none;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
    }

    .nav-links button:hover {
      color: var(--text);
      background: rgba(255, 255, 255, 0.05);
    }

    .auth-area { min-width: 150px; display: flex; justify-content: flex-end; }

    .auth-signed {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 8px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
    }

    .avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: rgba(88, 222, 215, 0.18);
      color: var(--accent);
      font-weight: 800;
    }

    .auth-name {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }

    .hero { padding: 66px 0 24px; }

    .hero-grid {
      display: grid;
      gap: 26px;
      grid-template-columns: 1.12fr 0.88fr;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 11px;
      border-radius: 999px;
      border: 1px solid rgba(88, 222, 215, 0.35);
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    h1 {
      margin: 16px 0;
      font-size: clamp(36px, 6vw, 68px);
      line-height: 0.98;
      letter-spacing: -0.03em;
      max-width: 720px;
    }

    .lead {
      margin: 0;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.7;
      max-width: 680px;
    }

    .panel {
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02)), var(--panel);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 22px;
    }

    .panel h2, .panel h3 { margin-top: 0; }

    .section { padding: 58px 0; }
    .section-alt {
      background: rgba(255, 255, 255, 0.02);
      border-top: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }

    .section-head {
      max-width: 720px;
      margin-bottom: 26px;
    }

    .section-head h2 {
      margin: 10px 0 12px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.04;
      letter-spacing: -0.03em;
    }

    .section-head p {
      margin: 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
    }

    .grid-2 {
      display: grid;
      gap: 22px;
      grid-template-columns: 1.02fr 0.98fr;
      align-items: start;
    }

    .grid-3 {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(3, 1fr);
    }

    label {
      display: block;
      margin: 13px 0 6px;
      font-size: 13px;
      font-weight: 700;
      color: rgba(246, 241, 231, 0.84);
    }

    input, select, textarea {
      width: 100%;
      background: #041720;
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 12px;
      padding: 11px 12px;
      outline: none;
    }

    input:focus, select:focus, textarea:focus {
      border-color: rgba(88, 222, 215, 0.65);
      box-shadow: 0 0 0 3px rgba(88, 222, 215, 0.12);
    }

    textarea { min-height: 120px; resize: vertical; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      border-radius: 12px;
      padding: 11px 16px;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }

    .btn:hover { transform: translateY(-1px); }
    .btn:disabled { opacity: 0.65; cursor: wait; transform: none; }

    .btn-primary {
      background: var(--accent);
      color: #062028;
    }

    .btn-ghost {
      background: transparent;
      color: var(--text);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .btn-orange {
      background: rgba(240, 121, 69, 0.14);
      color: var(--orange);
      border: 1px solid rgba(240, 121, 69, 0.28);
    }

    .full { width: 100%; }
    .mt-12 { margin-top: 12px; }
    .mt-18 { margin-top: 18px; }
    .mt-24 { margin-top: 24px; }

    .muted { color: var(--muted); }
    .small { font-size: 13px; line-height: 1.6; }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 16px 0;
    }

    .tab {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 700;
    }

    .tab.active {
      color: var(--text);
      border-color: rgba(88, 222, 215, 0.45);
      background: rgba(88, 222, 215, 0.08);
    }

    .hidden { display: none !important; }

    .form-error {
      min-height: 20px;
      margin: 10px 0 0;
      color: #ffb199;
      font-size: 13px;
      font-weight: 600;
    }

    .result-card,
    .product-card,
    .saved-card,
    .trust-card,
    .guide-route {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 18px;
    }

    .result-card h3,
    .product-card h3,
    .saved-card h4,
    .trust-card h3,
    .guide-route h4 {
      margin: 0 0 8px;
    }

    .timeline {
      margin: 18px 0;
      padding-left: 20px;
      display: grid;
      gap: 12px;
    }

    .timeline li {
      padding-left: 6px;
    }

    .timeline .time {
      display: inline-block;
      min-width: 88px;
      color: var(--accent);
      font-weight: 800;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .result-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 18px;
    }

    .result-cols ul,
    .product-includes,
    .guide-route ul,
    .guide-list {
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--muted);
      display: grid;
      gap: 8px;
    }

    .result-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }

    .saved-list {
      display: grid;
      gap: 12px;
      margin-top: 18px;
    }

    .saved-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .saved-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .saved-actions button {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 8px 10px;
      cursor: pointer;
    }

    .product-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(3, 1fr);
    }

    .product-card {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .product-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }

    .product-destination {
      color: var(--accent);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .product-price {
      font-weight: 800;
      white-space: nowrap;
    }

    .product-actions {
      margin-top: auto;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .trust-grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(3, 1fr);
    }

    .trust-card p {
      margin: 0;
      color: var(--muted);
    }

    .icon-chip {
      width: 38px;
      height: 38px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: rgba(88, 222, 215, 0.12);
      color: var(--accent);
      font-weight: 900;
      margin-bottom: 12px;
    }

    .footer {
      border-top: 1px solid var(--line);
      padding: 26px 0 42px;
      color: var(--muted);
      font-size: 14px;
    }

    .footer-flex {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .modal {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: none;
    }

    .modal.open { display: block; }

    .modal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(2, 10, 14, 0.72);
      backdrop-filter: blur(6px);
    }

    .modal-card {
      position: relative;
      width: min(680px, calc(100vw - 32px));
      margin: 7vh auto;
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.02)), #07222c;
      border: 1px solid var(--line);
      border-radius: 26px;
      box-shadow: var(--shadow);
      padding: 22px;
      max-height: 86vh;
      overflow: auto;
    }

    .modal-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 34px;
      height: 34px;
      border-radius: 10px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.04);
      color: var(--text);
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }

    .checkout-summary {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      margin-bottom: 14px;
    }

    .guide-notice {
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid rgba(88,222,215,0.28);
      background: rgba(88,222,215,0.07);
      color: rgba(246,241,231,0.88);
      margin: 14px 0;
      font-size: 14px;
    }

    .toast {
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%) translateY(18px);
      opacity: 0;
      pointer-events: none;
      z-index: 200;
      width: min(560px, calc(100vw - 32px));
      background: #0b3140;
      color: var(--text);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 14px;
      padding: 13px 16px;
      box-shadow: var(--shadow);
      transition: opacity 0.22s ease, transform 0.22s ease;
      font-weight: 600;
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .toast.error {
      border-color: rgba(240,121,69,0.55);
    }

    @media (max-width: 980px) {
      .hero-grid,
      .grid-2,
      .result-cols {
        grid-template-columns: 1fr;
      }

      .product-grid,
      .grid-3,
      .trust-grid {
        grid-template-columns: 1fr;
      }

      .nav {
        flex-wrap: wrap;
      }

      .nav-links {
        order: 3;
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>

  <header class="site-header">
    <div class="container nav">
      <a class="brand" href="#top">TripMint</a>

      <nav class="nav-links" aria-label="Primary">
        <button type="button" data-scroll="planner">Planner</button>
        <button type="button" data-scroll="guides">Guides</button>
        <button type="button" data-scroll="trust">Trust</button>
        <button type="button" data-scroll="contact">Contact</button>
      </nav>

      <div class="auth-area" id="authArea"></div>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top">
      <div class="container hero-grid">
        <div>
          <span class="badge">Travel decisions, made clear</span>
          <h1>Good travel planning is mostly knowing what not to do.</h1>
          <p class="lead">
            TripMint helps travellers build one excellent day, not a stressful checklist.
            Choose a destination, protect the anchor moment, make graceful cuts, and buy
            source-led decision guides that keep volatile details as confirmation prompts.
          </p>

          <div class="mt-24" style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn btn-primary" type="button" data-scroll="planner">Build a one-day plan</button>
            <button class="btn btn-ghost" type="button" data-scroll="guides">Explore paid guides</button>
          </div>
        </div>

        <div class="panel">
          <h2>Start with the checklist</h2>
          <p class="muted small">
            Get the free booking and packing checklist, plus a note when secure checkout opens.
          </p>

          <form id="launchForm">
            <label for="launchEmail">Email address</label>
            <input id="launchEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
            <button class="btn btn-primary full mt-12" type="submit">Join the launch list</button>
          </form>

          <div class="mt-18 small muted">
            TripMint sells digital planning guides. It is not a travel agent or booking provider.
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="planner">
      <div class="container">
        <div class="section-head">
          <span class="badge">One-day itinerary builder</span>
          <h2>Make the day easy to choose.</h2>
          <p>
            Give the traveller a small number of route identities, explain what each route protects
            and gives up, and include graceful cuts. No invented opening hours, no fake urgency.
          </p>
        </div>

        <div class="grid-2">
          <div class="panel">
            <h2>Plan a better travel day</h2>

            <form id="planForm">
              <label for="destination">Destination</label>
              <select id="destination">
                <option value="rome">Rome</option>
                <option value="florence">Florence</option>
                <option value="paris">Paris</option>
                <option value="lisbon">Lisbon</option>
                <option value="custom">Custom destination</option>
              </select>

              <div id="customDestinationWrap" class="hidden">
                <label for="customDestination">Custom destination name</label>
                <input id="customDestination" type="text" placeholder="Example: Kyoto, Accra, Mexico City">
              </div>

              <label for="planDate">Travel date</label>
              <input id="planDate" type="date">

              <label for="priority">Priority</label>
              <select id="priority">
                <option value="firsttime">First-time essentials</option>
                <option value="culture">Culture and landmarks</option>
                <option value="food">Food and local rhythm</option>
                <option value="family">Easy family pace</option>
                <option value="hidden">Hidden corners and slower paths</option>
              </select>

              <label for="pace">Pace</label>
              <select id="pace">
                <option value="balanced">Balanced</option>
                <option value="slow">Slow and graceful</option>
                <option value="packed">Packed but smart</option>
              </select>

              <label for="constraint">Main constraint</label>
              <select id="constraint">
                <option value="none">No major constraint</option>
                <option value="mobility">Mobility or stamina</option>
                <option value="heat">Heat or weather</option>
                <option value="rain">Rain backup needed</option>
                <option value="budget">Budget sensitivity</option>
              </select>

              <button class="btn btn-primary full mt-18" type="submit">Generate itinerary</button>
            </form>
          </div>

          <div>
            <div class="panel">
              <h2>Your plan</h2>
              <div id="itineraryOutput" class="muted">
                Generate a plan to see route identities, graceful cuts, and recovery branches.
              </div>
            </div>

            <div class="panel mt-18">
              <h2>Saved itineraries</h2>
              <div id="savedItineraries" class="saved-list"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="guides">
      <div class="container">
        <div class="section-head">
          <span class="badge">Digital guides</span>
          <h2>Decision guides for one excellent day.</h2>
          <p>
            Each guide keeps volatile details as confirmation prompts. Before booking or leaving,
            travellers should check current hours, tickets, access, weather, and transport with official sources.
          </p>
        </div>

        <div class="product-grid" id="productGrid"></div>
      </div>
    </section>

    <section class="section" id="trust">
      <div class="container">
        <div class="section-head">
          <span class="badge">Trust signals</span>
          <h2>Clear, honest, and ready for live checkout.</h2>
          <p>
            Keep launch information clear. TripMint will verify payment server-side before issuing
            a download link and will never collect card details directly.
          </p>
        </div>

        <div class="trust-grid">
          <div class="trust-card">
            <div class="icon-chip">Secure</div>
            <h3>Secure checkout path</h3>
            <p>
              TripMint will verify payment server-side before issuing a download link.
              The site will never collect card details directly.
            </p>
          </div>

          <div class="trust-card">
            <div class="icon-chip">Clear</div>
            <h3>No hidden booking role</h3>
            <p>
              TripMint sells its own digital planning guides. It is not a travel agent
              or booking provider.
            </p>
          </div>

          <div class="trust-card">
            <div class="icon-chip">Source-led</div>
            <h3>Official-source prompts</h3>
            <p>
              Volatile details stay as confirmation prompts. Before you book or leave,
              check current hours, tickets, access, weather, and transport with official sources.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="section section-alt" id="contact">
      <div class="container">
        <div class="section-head">
          <span class="badge">Contact</span>
          <h2>Keep launch information clear.</h2>
          <p>
            Join the launch list or contact support if you need to ask about a guide before checkout opens.
          </p>
        </div>

        <div class="grid-2">
          <div class="panel">
            <h2>Send a message</h2>

            <form id="contactForm">
              <label for="contactName">Name</label>
              <input id="contactName" type="text" autocomplete="name" required>

              <label for="contactEmail">Email</label>
              <input id="contactEmail" type="email" autocomplete="email" required>

              <label for="contactSubject">Subject</label>
              <input id="contactSubject" type="text" required>

              <label for="contactMessage">Message</label>
              <textarea id="contactMessage" required></textarea>

              <button class="btn btn-primary mt-18" type="submit">Send message</button>
            </form>
          </div>

          <div class="panel">
            <h2>What happens next</h2>
            <div class="guide-notice">
              TripMint will publish the operational support contact before opening live checkout.
            </div>
            <p class="muted">
              This plain-language policy is being finalised before sales begin. It will be updated
              with the registered business details and reviewed for the applicable customer markets
              before live payment activation.
            </p>
            <p class="muted mt-12">
              If you have a duplicate charge, failed delivery, or material access problem, TripMint
              will provide a clear support path.
            </p>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="container footer-flex">
      <div>TripMint — Practical one-day travel decisions.</div>
      <div>Demo build. Connect Paystack keys before accepting live payments.</div>
    </div>
  </footer>

  <div class="modal" id="authModal" aria-hidden="true">
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card">
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>

      <h2 id="authTitle">Sign in to TripMint</h2>

      <div class="tabs">
        <button type="button" id="authTabSignIn" class="tab active">Sign in</button>
        <button type="button" id="authTabSignUp" class="tab">Create account</button>
      </div>

      <form id="signinForm">
        <label for="signinEmail">Email</label>
        <input id="signinEmail" type="email" autocomplete="email" required>

        <label for="signinPassword">Password</label>
        <input id="signinPassword" type="password" autocomplete="current-password" minlength="8" required>

        <div class="form-error" id="signinError"></div>

        <button class="btn btn-primary full mt-12" type="submit">Sign in</button>
      </form>

      <form id="signupForm" class="hidden">
        <label for="signupName">Name</label>
        <input id="signupName" type="text" autocomplete="name" required>

        <label for="signupEmail">Email</label>
        <input id="signupEmail" type="email" autocomplete="email" required>

        <label for="signupPassword">Password</label>
        <input id="signupPassword" type="password" autocomplete="new-password" minlength="8" required>

        <div class="form-error" id="signupError"></div>

        <button class="btn btn-primary full mt-12" type="submit">Create account</button>
      </form>

      <button class="btn btn-ghost full mt-12" type="button" id="demoAuthBtn">Use demo traveller</button>

      <p class="muted small mt-18">
        Demo auth stores accounts in this browser. Replace with real auth before live sales.
      </p>
    </div>
  </div>

  <div class="modal" id="checkoutModal" aria-hidden="true">
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card">
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>

      <h2>Checkout</h2>

      <div class="checkout-summary">
        <div>
          <div class="muted small">Guide</div>
          <strong id="checkoutProductTitle"></strong>
        </div>
        <div class="product-price" id="checkoutProductPrice"></div>
      </div>

      <label for="checkoutEmail">Email for delivery</label>
      <input id="checkoutEmail" type="email" autocomplete="email">

      <div class="guide-notice" id="checkoutNotice"></div>
      <div class="form-error" id="checkoutError"></div>

      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:18px;">
        <button class="btn btn-primary" type="button" id="checkoutButton">Pay securely</button>
        <button class="btn btn-ghost" type="button" id="checkoutCancelButton">Cancel</button>
      </div>
    </div>
  </div>

  <div class="modal" id="guideModal" aria-hidden="true">
    <div class="modal-backdrop" data-close></div>
    <div class="modal-card">
      <button class="modal-close" type="button" data-close aria-label="Close">×</button>
      <h2 id="guideModalTitle"></h2>
      <div id="guideModalBody"></div>
    </div>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite"></div>

  <script>
    (function () {
      var API_BASE = '/api';

      var LS_KEYS = {
        users: 'tm_users',
        session: 'tm_session',
        itineraries: 'tm_itineraries',
        purchases: 'tm_purchases',
        contacts: 'tm_contacts',
        launch: 'tm_launch'
      };

      var state = {
        user: null,
        currentItinerary: null,
        checkoutProduct: null,
        pendingCheckoutHandle: null,
        config: {
          paystackPublicKey: '',
          mode: 'test',
          checkoutEnabled: false
        },
        products: []
      };

      var destinationCatalog = {
        rome: {
          label: 'Rome',
          routes: [
            {
              id: 'first-timer',
              title: 'First-timer classic',
              protects: 'the major ancient-core anchors',
              givesUp: 'long neighbourhood lingering',
              blocks: [
                'Anchor the morning to your timed Colosseum or Forum entry and arrive early.',
                'Keep the late morning for the walkable ancient core rather than another museum.',
                'Move lunch away from the monument perimeter to protect value and calm.',
                'Close with a historic-centre walk that ends at a viewpoint before dinner.'
              ]
            },
            {
              id: 'slow-food',
              title: 'Slow food and neighbourhood rhythm',
              protects: 'food, pauses, and one major site',
              givesUp: 'multiple landmark interiors',
              blocks: [
                'Start with one major anchor and keep the rest of the morning loose.',
                'Use midday for a long meal or market stop instead of a second attraction.',
                'Choose one neighbourhood for the afternoon to reduce transit friction.',
                'End with a gelato or cafe pause near your dinner area.'
              ]
            },
            {
              id: 'family-easy',
              title: 'Easy family pace',
              protects: 'low-stress movement and breaks',
              givesUp: 'dense museum time',
              blocks: [
                'Choose one outdoor anchor that is easy to reach and easy to leave.',
                'Build in a snack or park break before energy drops.',
                'Keep the afternoon to one short walk or one indoor stop.',
                'Finish early near dinner so the day ends calmly.'
              ]
            }
          ],
          recovery: [
            'If timed entry fails, swap the major interior for a viewpoint and book the next available slot.',
            'If heat is high, move indoor during midday and keep evening for the historic centre.',
            'If transport is disrupted, stay in one district instead of crossing the city.'
          ]
        },
        florence: {
          label: 'Florence',
          routes: [
            {
              id: 'first-timer',
              title: 'First-timer classic',
              protects: 'the cathedral core and one museum anchor',
              givesUp: 'spontaneous long detours',
              blocks: [
                'Anchor the morning around the cathedral area and confirm access rules.',
                'Use one timed museum or gallery slot as the day pressure point.',
                'Keep lunch simple near the centre but away from the busiest frontage.',
                'Finish with a river-side or viewpoint walk while light improves.'
              ]
            },
            {
              id: 'slow-food',
              title: 'Slow food and craft rhythm',
              protects: 'market food, craft streets, and one anchor',
              givesUp: 'rushing major interiors',
              blocks: [
                'Start with one anchor and keep the first hour walkable.',
                'Use midday for market food or a long cafe stop.',
                'Choose one craft district for the afternoon instead of another museum.',
                'Close with a short riverside or plaza loop.'
              ]
            },
            {
              id: 'family-easy',
              title: 'Easy family pace',
              protects: 'short distances and frequent resets',
              givesUp: 'long queue-heavy interiors',
              blocks: [
                'Choose one open anchor and keep the approach simple.',
                'Build in a snack or playground reset before lunch.',
                'Keep the afternoon to one easy indoor or shaded stop.',
                'Finish near dinner to avoid late backtracking.'
              ]
            }
          ],
          recovery: [
            'If the main gallery is sold out, protect the day by swapping it for a shorter palace or viewpoint.',
            'If rain arrives, keep one indoor anchor and shorten the river walk.',
            'If crowds peak, shift major photos to early morning or late evening.'
          ]
        },
        paris: {
          label: 'Paris',
          routes: [
            {
              id: 'first-timer',
              title: 'First-timer classic',
              protects: 'one major anchor and a walkable centre',
              givesUp: 'trying to cover multiple arrondissements',
              blocks: [
                'Start with the anchor that requires reservation and confirm entry windows.',
                'Keep the late morning to one walkable district around that anchor.',
                'Use lunch to reset away from the most tourist-facing streets.',
                'Finish with a river or viewpoint loop that does not require another ticket.'
              ]
            },
            {
              id: 'slow-food',
              title: 'Slow cafe and neighbourhood day',
              protects: 'cafe time, bakeries, and one museum or gallery',
              givesUp: 'monument hopping',
              blocks: [
                'Choose one neighbourhood and keep the day inside it.',
                'Use midday for a long lunch or market stop.',
                'Keep the afternoon to one indoor stop or one slow walk.',
                'Close with an evening cafe pause near dinner.'
              ]
            },
            {
              id: 'family-easy',
              title: 'Easy family pace',
              protects: 'simple metro choices and rest breaks',
              givesUp: 'long interior tours',
              blocks: [
                'Choose one anchor with easy access and clear exit options.',
                'Build in a park or snack break before lunch.',
                'Keep the afternoon to one short activity and one open space.',
                'Finish near dinner to avoid late transfers.'
              ]
            }
          ],
          recovery: [
            'If metro lines are disrupted, choose one district and make the day walkable.',
            'If rain arrives, swap the river loop for a covered passage or museum cafe.',
            'If timed entry fails, protect the day with a viewpoint or shorter interior visit.'
          ]
        },
        lisbon: {
          label: 'Lisbon',
          routes: [
            {
              id: 'first-timer',
              title: 'First-timer classic',
              protects: 'one viewpoint anchor and one historic district',
              givesUp: 'chasing every miradouro',
              blocks: [
                'Start with one viewpoint or landmark before crowds and heat build.',
                'Keep the late morning inside one historic district.',
                'Use lunch to reset away from tram-line pressure.',
                'Finish with a riverside or lower-city walk that stays simple.'
              ]
            },
            {
              id: 'slow-food',
              title: 'Slow food and hill-friendly rhythm',
              protects: 'food stops and gentle routing',
              givesUp: 'steep multi-stop sprinting',
              blocks: [
                'Choose one district and avoid repeated hill crossings.',
                'Use midday for a long meal or market stop.',
                'Keep the afternoon to one cafe, shop street, or small museum.',
                'Close with a sunset viewpoint if energy remains.'
              ]
            },
            {
              id: 'family-easy',
              title: 'Easy family pace',
              protects: 'low-stress transport and rest points',
              givesUp: 'dense historic interiors',
              blocks: [
                'Choose one anchor with easy access and clear shade.',
                'Build in a snack or park break before lunch.',
                'Keep the afternoon to one short ride or one indoor stop.',
                'Finish near dinner to avoid late hills.'
              ]
            }
          ],
          recovery: [
            'If hills are too much, switch to lower-city or riverside routing.',
            'If heat is high, move indoor during midday and keep evening for viewpoints.',
            'If trams are crowded, use one alternative route instead of waiting.'
          ]
        }
      };

      var products = [
        {
          handle: 'rome-one-day-first-timer-decision-guide',
          destinationKey: 'rome',
          title: 'Rome: One-Day First-Timer Decision Guide',
          price: 4500,
          currency: 'NGN',
          status: 'published',
          description: 'Choose the right Rome route, protect timed entry, and know what to cut.',
          includes: [
            '3 route identities',
            'If-this-happens branches',
            'Official-source checklist'
          ]
        },
        {
          handle: 'florence-one-day-decision-guide',
          destinationKey: 'florence',
          title: 'Florence: One-Day Decision Guide',
          price: 4000,
          currency: 'NGN',
          status: 'published',
          description: 'Protect the anchor museum, keep lunch calm, and avoid overloading the centre.',
          includes: [
            '3 route identities',
            'Graceful cuts',
            'Rain and crowd recovery'
          ]
        },
        {
          handle: 'paris-one-day-decision-guide',
          destinationKey: 'paris',
          title: 'Paris: One-Day Decision Guide',
          price: 4200,
          currency: 'NGN',
          status: 'published',
          description: 'Choose one district, protect the reservation, and keep the day elegant.',
          includes: [
            '3 route identities',
            'Transit disruption branches',
            'Official-source checklist'
          ]
        }
      ];

      function $(id) {
        return document.getElementById(id);
      }

      function getText(id) {
        var el = $(id);
        return el ? el.value.trim() : '';
      }

      function getSelect(id) {
        var el = $(id);
        return el ? el.value : '';
      }

      function escapeHtml(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function readStore(key, fallback) {
        try {
          var raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
          return fallback;
        }
      }

      function writeStore(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
          // Storage may be unavailable in private mode. The app should still work.
        }
      }

      function randomId(prefix) {
        var rand = '';

        if (window.crypto && window.crypto.getRandomValues) {
          var bytes = new Uint8Array(10);
          window.crypto.getRandomValues(bytes);

          for (var i = 0; i < bytes.length; i++) {
            var hex = bytes[i].toString(16);
            if (hex.length < 2) hex = '0' + hex;
            rand += hex;
          }
        } else {
          rand = String(Date.now()) + String(Math.random()).slice(2);
        }

        return (prefix || 'id') + '-' + rand;
      }

      function isValidEmail(email) {
        return String(email || '').indexOf('@') > 0 &&
          String(email || '').indexOf('.') > 0 &&
          String(email || '').indexOf(' ') === -1;
      }

      function showToast(message, isError) {
        var toast = $('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = 'toast show' + (isError ? ' error' : '');

        setTimeout(function () {
          toast.className = 'toast';
        }, 4200);
      }

      function scrollToElement(id) {
        var el = $(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      function setButtonLoading(button, loading, label) {
        if (!button) return;

        if (loading) {
          button.dataset.originalText = button.textContent;
          button.textContent = label || 'Working...';
          button.disabled = true;
        } else {
          button.textContent = button.dataset.originalText || button.textContent;
          button.disabled = false;
        }
      }

      function getQueryParameter(name) {
        var query = window.location.search.substring(1);
        if (!query) return '';

        var pairs = query.split('&');

        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split('=');
          if (decodeURIComponent(pair[0]) === name) {
            return decodeURIComponent(pair[1] || '');
          }
        }

        return '';
      }

      function bytesToHex(buffer) {
        var arr = new Uint8Array(buffer);
        var out = '';

        for (var i = 0; i < arr.length; i++) {
          var hex = arr[i].toString(16);
          if (hex.length < 2) hex = '0' + hex;
          out += hex;
        }

        return out;
      }

      async function hashPassword(password, salt) {
        if (window.crypto && window.crypto.subtle) {
          var data = new TextEncoder().encode(password + ':' + salt);
          var digest = await window.crypto.subtle.digest('SHA-256', data);
          return bytesToHex(digest);
        }

        var h = 5381;
        var s = password + ':' + salt;

        for (var i = 0; i < s.length; i++) {
          h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        }

        return 'fallback-' + h.toString(16);
      }

      function getUsers() {
        return readStore(LS_KEYS.users, []);
      }

      function saveUsers(users) {
        writeStore(LS_KEYS.users, users);
      }

      function findUserByEmail(email) {
        var users = getUsers();
        var normalized = String(email || '').toLowerCase();

        for (var i = 0; i < users.length; i++) {
          if (users[i].email === normalized) {
            return users[i];
          }
        }

        return null;
      }

      function setSession(user) {
        var session = {
          id: user.id,
          name: user.name,
          email: user.email,
          token: randomId('session'),
          createdAt: new Date().toISOString()
        };

        state.user = session;
        writeStore(LS_KEYS.session, session);

        renderAuthArea();
        renderSavedItineraries();
        renderProducts();

        if (state.pendingCheckoutHandle) {
          var handle = state.pendingCheckoutHandle;
          state.pendingCheckoutHandle = null;

          setTimeout(function () {
            openCheckout(handle);
          }, 90);
        }
      }

      function clearSession() {
        state.user = null;

        try {
          localStorage.removeItem(LS_KEYS.session);
        } catch (err) {
          // Ignore storage errors.
        }

        renderAuthArea();
        renderSavedItineraries();
        renderProducts();
      }

      async function signUp(name, email, password) {
        var users = getUsers();
        var normalizedEmail = String(email || '').toLowerCase();

        for (var i = 0; i < users.length; i++) {
          if (users[i].email === normalizedEmail) {
            return 'An account with this email already exists.';
          }
        }

        var salt = randomId('salt');
        var hash = await hashPassword(password, salt);

        var user = {
          id: randomId('user'),
          name: String(name || '').trim(),
          email: normalizedEmail,
          salt: salt,
          hash: hash,
          createdAt: new Date().toISOString()
        };

        users.push(user);
        saveUsers(users);
        setSession(user);

        return null;
      }

      async function signIn(email, password) {
        var user = findUserByEmail(email);

        if (!user) {
          return 'No account found with this email.';
        }

        var hash = await hashPassword(password, user.salt);

        if (hash !== user.hash) {
          return 'Incorrect password. Try again.';
        }

        setSession(user);
        return null;
      }

      async function ensureDemoUser() {
        var existing = findUserByEmail('demo@tripmint.com');
        if (existing) return;

        var salt = randomId('salt');
        var hash = await hashPassword('tripmint123', salt);
        var users = getUsers();

        users.push({
          id: randomId('user'),
          name: 'TripMint Demo',
          email: 'demo@tripmint.com',
          salt: salt,
          hash: hash,
          createdAt: new Date().toISOString()
        });

        saveUsers(users);
      }

      async function useDemoAccount() {
        var email = 'demo@tripmint.com';
        var password = 'tripmint123';

        var existing = findUserByEmail(email);

        if (!existing) {
          var err = await signUp('TripMint Demo', email, password);
          if (err) {
            showToast(err, true);
            return;
          }
        } else {
          var loginErr = await signIn(email, password);
          if (loginErr) {
            showToast(loginErr, true);
            return;
          }
        }

        closeAllModals();
        showToast('Signed in as demo traveller.');
      }

      function requireAuth(message, pendingHandle) {
        if (state.user) return true;

        if (pendingHandle) {
          state.pendingCheckoutHandle = pendingHandle;
        }

        openModal('authModal');

        if (message) {
          showToast(message, true);
        }

        return false;
      }

      function renderAuthArea() {
        var el = $('authArea');
        if (!el) return;

        if (state.user) {
          var initial = escapeHtml((state.user.name || 'U').charAt(0).toUpperCase());

          el.innerHTML =
            '<div class="auth-signed">' +
              '<span class="avatar">' + initial + '</span>' +
              '<span class="auth-name">' + escapeHtml(state.user.name) + '</span>' +
              '<button class="btn btn-ghost" type="button" id="signOutBtn">Sign out</button>' +
            '</div>';

          var signOutBtn = $('signOutBtn');

          if (signOutBtn) {
            signOutBtn.onclick = function () {
              clearSession();
              showToast('Signed out.');
            };
          }
        } else {
          el.innerHTML = '<button class="btn btn-ghost" type="button" id="openAuthBtn">Sign in</button>';

          var openAuthBtn = $('openAuthBtn');

          if (openAuthBtn) {
            openAuthBtn.onclick = function () {
              openModal('authModal');
            };
          }
        }
      }

      function switchAuthTab(tab) {
        var signInTab = $('authTabSignIn');
        var signUpTab = $('authTabSignUp');
        var signInForm = $('signinForm');
        var signUpForm = $('signupForm');
        var authTitle = $('authTitle');

        if (!signInTab || !signUpTab || !signInForm || !signUpForm) return;

        if (tab === 'signup') {
          signInTab.classList.remove('active');
          signUpTab.classList.add('active');
          signInForm.classList.add('hidden');
          signUpForm.classList.remove('hidden');
          if (authTitle) authTitle.textContent = 'Create your TripMint account';
        } else {
          signUpTab.classList.remove('active');
          signInTab.classList.add('active');
          signUpForm.classList.add('hidden');
          signInForm.classList.remove('hidden');
          if (authTitle) authTitle.textContent = 'Sign in to TripMint';
        }
      }

      function openModal(id) {
        closeAllModals();

        var modal = $(id);
        if (!modal) return;

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');

        var focusable = modal.querySelector('button, input, select, textarea');
        if (focusable) {
          setTimeout(function () {
            focusable.focus();
          }, 50);
        }
      }

      function closeAllModals() {
        var modals = document.querySelectorAll('.modal');

        for (var i = 0; i < modals.length; i++) {
          modals[i].classList.remove('open');
          modals[i].setAttribute('aria-hidden', 'true');
        }

        document.body.classList.remove('no-scroll');
      }

      function getItineraries() {
        return readStore(LS_KEYS.itineraries, []);
      }

      function saveItineraries(list) {
        writeStore(LS_KEYS.itineraries, list);
      }

      function findItinerary(id) {
        var list = getItineraries();

        for (var i = 0; i < list.length; i++) {
          if (list[i].id === id) {
            return list[i];
          }
        }

        return null;
      }

      function saveCurrentItinerary(itinerary) {
        if (!requireAuth('Sign in to save itineraries.')) return;

        var list = getItineraries();
        var next = [];
        var found = false;

        itinerary.updatedAt = new Date().toISOString();

        for (var i = 0; i < list.length; i++) {
          if (list[i].id === itinerary.id) {
            next.push(itinerary);
            found = true;
          } else {
            next.push(list[i]);
          }
        }

        if (!found) {
          next.unshift(itinerary);
        }

        if (next.length > 30) {
          next.length = 30;
        }

        saveItineraries(next);
        renderSavedItineraries();
        showToast('Itinerary saved.');
      }

      function chooseRoute(dest, priority) {
        if (!dest || !dest.routes || !dest.routes.length) return null;

        var priorityMap = {
          firsttime: 0,
          culture: 0,
          food: 1,
          family: 2,
          hidden: 1
        };

        var index = priorityMap[priority] || 0;

        if (index >= dest.routes.length) {
          index = 0;
        }

        return dest.routes[index];
      }

      function customDestinationPlan(name) {
        return {
          title: 'Custom one-day plan',
          protects: 'one anchor experience',
          givesUp: 'trying to do everything',
          blocks: [
            'Choose one anchor experience and protect it with a timed or early start.',
            'Keep the late morning to one walkable area around that anchor.',
            'Use lunch as a real reset, not a rushed stop.',
            'Finish with one low-friction closing walk, viewpoint, or cafe.'
          ]
        };
      }

      function defaultRecoveryBranches() {
        return [
          'If the anchor is closed, swap it for the best nearby alternative and keep the meal timing stable.',
          'If energy drops, cut one indoor stop and protect the closing hour.',
          'If weather changes, move the outdoor block to the most protected part of the day.'
        ];
      }

      function generateItinerary() {
        var destinationKey = getSelect('destination');
        var destinationName = '';
        var destination = null;

        if (destinationKey === 'custom') {
          destinationName = getText('customDestination') || 'your destination';
        } else {
          destination = destinationCatalog[destinationKey];
          destinationName = destination ? destination.label : destinationKey;
        }

        var priority = getSelect('priority');
        var pace = getSelect('pace');
        var constraint = getSelect('constraint');

        var route = destination ? chooseRoute(destination, priority) : customDestinationPlan(destinationName);

        var items = [];
        var timeLabels = ['Morning', 'Midday', 'Afternoon', 'Evening'];
        var maxBlocks = pace === 'slow' ? 3 : 4;

        for (var i = 0; i < route.blocks.length && i < maxBlocks; i++) {
          items.push({
            label: timeLabels[i] || 'Later',
            text: route.blocks[i]
          });
        }

        if (pace === 'packed') {
          items.push({
            label: 'Optional',
            text: 'Add one low-friction stop only if the anchor, meal, and transport all remain calm.'
          });
        }

        var cuts = [
          'Keep one anchor and protect it.',
          'Choose a meal that resets energy, not one that creates pressure.',
          'End with the simplest possible closing move.'
        ];

        if (pace === 'slow') {
          cuts.push('Drop one indoor stop and keep the day spacious.');
        }

        if (constraint === 'mobility') {
          cuts.push('Choose one district and keep stairs, hills, and long transfers out of the plan.');
        }

        if (constraint === 'heat') {
          cuts.push('Move the most exposed walk to early morning or evening.');
        }

        if (constraint === 'rain') {
          cuts.push('Keep one indoor replacement ready and shorten outdoor transitions.');
        }

        if (constraint === 'budget') {
          cuts.push('Protect free or low-cost anchors and avoid paid add-ons unless they clearly improve the day.');
        }

        var branches = destination && destination.recovery ? destination.recovery.slice() : defaultRecoveryBranches();

        var summary = 'A ' + pace + ' ' + route.title.toLowerCase() + ' for ' + destinationName +
          ' that protects ' + route.protects + '. It gives up ' + route.givesUp + '.';

        var itinerary = {
          id: randomId('itin'),
          createdAt: new Date().toISOString(),
          destination: destinationName,
          routeTitle: route.title,
          priority: priority,
          pace: pace,
          constraint: constraint,
          summary: summary,
          items: items,
          cuts: cuts,
          branches: branches
        };

        state.currentItinerary = itinerary;
        renderItinerary(itinerary);
        scrollToElement('itineraryOutput');

        return itinerary;
      }

      function renderItinerary(itinerary) {
        var out = $('itineraryOutput');
        if (!out) return;

        var items = itinerary.items || [];
        var cuts = itinerary.cuts || [];
        var branches = itinerary.branches || [];

        var html = '<div class="result-card">';
        html += '<h3>' + escapeHtml(itinerary.routeTitle) + '</h3>';
        html += '<p class="muted">' + escapeHtml(itinerary.summary) + '</p>';

        html += '<ol class="timeline">';

        for (var i = 0; i < items.length; i++) {
          html += '<li><span class="time">' + escapeHtml(items[i].label) + '</span> ' +
            escapeHtml(items[i].text) + '</li>';
        }

        html += '</ol>';

        html += '<div class="result-cols">';
        html += '<div><h4>Graceful cuts</h4><ul>';

        for (var c = 0; c < cuts.length; c++) {
          html += '<li>' + escapeHtml(cuts[c]) + '</li>';
        }

        html += '</ul></div>';

        html += '<div><h4>If this happens</h4><ul>';

        for (var b = 0; b < branches.length; b++) {
          html += '<li>' + escapeHtml(branches[b]) + '</li>';
        }

        html += '</ul></div>';
        html += '</div>';

        html += '<div class="result-actions">' +
          '<button class="btn btn-primary" type="button" id="saveItineraryBtn">Save itinerary</button>' +
          '<button class="btn btn-ghost" type="button" id="copyItineraryBtn">Copy plan</button>' +
          '</div>';

        html += '</div>';

        out.innerHTML = html;

        var saveBtn = $('saveItineraryBtn');
        var copyBtn = $('copyItineraryBtn');

        if (saveBtn) {
          saveBtn.onclick = function () {
            saveCurrentItinerary(itinerary);
          };
        }

        if (copyBtn) {
          copyBtn.onclick = function () {
            copyItinerary(itinerary);
          };
        }
      }

      function itineraryToText(itinerary) {
        var nl = String.fromCharCode(10);
        var lines = [];

        lines.push('TripMint one-day plan: ' + itinerary.destination);
        lines.push('Route: ' + itinerary.routeTitle);
        lines.push('Summary: ' + itinerary.summary);
        lines.push('');
        lines.push('Plan:');

        var items = itinerary.items || [];

        for (var i = 0; i < items.length; i++) {
          lines.push('- ' + items[i].label + ': ' + items[i].text);
        }

        lines.push('');
        lines.push('Graceful cuts:');

        var cuts = itinerary.cuts || [];

        for (var c = 0; c < cuts.length; c++) {
          lines.push('- ' + cuts[c]);
        }

        lines.push('');
        lines.push('If this happens:');

        var branches = itinerary.branches || [];

        for (var b = 0; b < branches.length; b++) {
          lines.push('- ' + branches[b]);
        }

        return lines.join(nl);
      }

      function fallbackCopy(text) {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();

        try {
          document.execCommand('copy');
          showToast('Plan copied.');
        } catch (err) {
          showToast('Copy is not available in this browser.', true);
        }

        document.body.removeChild(ta);
      }

      function copyItinerary(itinerary) {
        var text = itineraryToText(itinerary);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast('Plan copied.');
          }, function () {
            fallbackCopy(text);
          });
        } else {
          fallbackCopy(text);
        }
      }

      function renderSavedItineraries() {
        var listEl = $('savedItineraries');
        if (!listEl) return;

        if (!state.user) {
          listEl.innerHTML = '<p class="muted">Sign in to save and reopen your itineraries.</p>';
          return;
        }

        var list = getItineraries();

        if (!list.length) {
          listEl.innerHTML = '<p class="muted">No saved itineraries yet. Generate one and save it.</p>';
          return;
        }

        var html = '';

        for (var i = 0; i < list.length; i++) {
          var item = list[i];

          html += '<article class="saved-card">' +
            '<div>' +
              '<h4>' + escapeHtml(item.routeTitle || 'Itinerary') + '</h4>' +
              '<p class="muted small">' + escapeHtml(item.destination || 'Destination') + ' · ' +
                escapeHtml(item.pace || 'balanced') + ' pace</p>' +
            '</div>' +
            '<div class="saved-actions">' +
              '<button type="button" data-action="load" data-id="' + escapeHtml(item.id) + '">Open</button>' +
              '<button type="button" data-action="delete" data-id="' + escapeHtml(item.id) + '">Delete</button>' +
            '</div>' +
          '</article>';
        }

        listEl.innerHTML = html;
      }

      function getProducts() {
        return products.slice();
      }

      function findProduct(handle) {
        for (var i = 0; i < state.products.length; i++) {
          if (state.products[i].handle === handle) {
            return state.products[i];
          }
        }

        return null;
      }

      function formatPrice(product) {
        try {
          return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: product.currency
          }).format(product.price);
        } catch (err) {
          return product.currency + ' ' + product.price;
        }
      }

      function getPurchases() {
        return readStore(LS_KEYS.purchases, []);
      }

      function isPurchased(handle) {
        var list = getPurchases();

        for (var i = 0; i < list.length; i++) {
          if (list[i].productHandle === handle && (list[i].status === 'success' || list[i].status === 'demo')) {
            return true;
          }
        }

        return false;
      }

      function recordPurchase(handle, reference, status) {
        var list = getPurchases();

        list.unshift({
          id: randomId('purchase'),
          productHandle: handle,
          reference: reference,
          status: status || 'success',
          createdAt: new Date().toISOString()
        });

        if (list.length > 50) {
          list.length = 50;
        }

        writeStore(LS_KEYS.purchases, list);
        renderProducts();
      }

      function renderProducts() {
        var grid = $('productGrid');
        if (!grid) return;

        var html = '';

        for (var i = 0; i < state.products.length; i++) {
          var product = state.products[i];
          var purchased = isPurchased(product.handle);

          html += '<article class="product-card">';
          html += '<div class="product-top">';
          html += '<div>';
          html += '<div class="product-destination">' + escapeHtml(product.destinationKey) + '</div>';
          html += '<h3>' + escapeHtml(product.title) + '</h3>';
          html += '</div>';
          html += '<div class="product-price">' + escapeHtml(formatPrice(product)) + '</div>';
          html += '</div>';

          html += '<p class="muted">' + escapeHtml(product.description) + '</p>';

          html += '<ul class="product-includes">';

          for (var j = 0; j < product.includes.length; j++) {
            html += '<li>' + escapeHtml(product.includes[j]) + '</li>';
          }

          html += '</ul>';

          html += '<div class="product-actions">';

          if (purchased) {
            html += '<button class="btn btn-primary" type="button" data-product-handle="' + escapeHtml(product.handle) + '" data-action="open-guide">Open guide</button>';
          } else {
            html += '<button class="btn btn-primary" type="button" data-product-handle="' + escapeHtml(product.handle) + '" data-action="buy">Buy guide</button>';
          }

          html += '</div>';
          html += '</article>';
        }

        grid.innerHTML = html;
      }

      function loadConfig() {
        fetch(API_BASE + '/config')
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            state.config.paystackPublicKey = data.paystackPublicKey || '';
            state.config.mode = data.mode || 'test';
            state.config.checkoutEnabled = Boolean(data.checkoutEnabled);

            if (state.config.paystackPublicKey) {
              loadPaystackScript();
            }
          })
          .catch(function () {
            state.config.checkoutEnabled = false;
          });
      }

      function loadPaystackScript() {
        if (window.PaystackPop) return;

        var script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.head.appendChild(script);
      }

      function openCheckout(handle) {
        if (!requireAuth('Sign in before checkout.', handle)) return;

        var product = findProduct(handle);
        if (!product) return;

        state.checkoutProduct = product;

        $('checkoutProductTitle').textContent = product.title;
        $('checkoutProductPrice').textContent = formatPrice(product);
        $('checkoutEmail').value = state.user ? state.user.email : '';
        $('checkoutError').textContent = '';

        $('checkoutNotice').textContent = state.config.checkoutEnabled
          ? 'Secure Paystack checkout is ready. Card details are handled by Paystack, not TripMint.'
          : 'Paystack keys are not added yet. Use demo checkout today and connect keys tomorrow.';

        openModal('checkoutModal');
      }

      function enableCheckoutButton() {
        setButtonLoading($('checkoutButton'), false);
      }

      function startCheckout() {
        var product = state.checkoutProduct;
        if (!product) return;

        var email = getText('checkoutEmail');

        if (!isValidEmail(email)) {
          $('checkoutError').textContent = 'Enter a valid delivery email.';
          return;
        }

        $('checkoutError').textContent = '';
        setButtonLoading($('checkoutButton'), true, 'Processing...');

        if (state.config.checkoutEnabled && window.PaystackPop) {
          var reference = 'tm_' + randomId('pay');

          var handler = window.PaystackPop.setup({
            key: state.config.paystackPublicKey,
            email: email,
            amount: product.price * 100,
            currency: product.currency,
            ref: reference,
            metadata: {
              productHandle: product.handle,
              title: product.title
            },
            callback: function (response) {
              verifyPayment(response.reference, product);
            },
            onClose: function () {
              enableCheckoutButton();
              showToast('Checkout closed.');
            }
          });

          handler.openIframe();
          return;
        }

        if (state.config.checkoutEnabled) {
          initializeServerCheckout(product, email);
          return;
        }

        simulateDemoCheckout(product);
      }

      function initializeServerCheckout(product, email) {
        fetch(API_BASE + '/paystack/initialize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            amount: product.price * 100,
            productHandle: product.handle,
            title: product.title
          })
        })
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (data.authorization_url) {
              window.location.href = data.authorization_url;
              return;
            }

            showToast(data.error || 'Checkout is not ready yet.', true);
            enableCheckoutButton();
          })
          .catch(function () {
            showToast('Could not start checkout.', true);
            enableCheckoutButton();
          });
      }

      function simulateDemoCheckout(product) {
        setTimeout(function () {
          var reference = 'demo_' + randomId('ref');
          recordPurchase(product.handle, reference, 'demo');

          closeAllModals();
          showToast('Demo purchase unlocked. Connect Paystack to take real payments.');
          openGuide(product.handle);
          enableCheckoutButton();
        }, 900);
      }

      function verifyPayment(reference, product) {
        fetch(API_BASE + '/paystack/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            reference: reference,
            productHandle: product ? product.handle : ''
          })
        })
          .then(function (response) {
            return response.json();
          })
          .then(function (data) {
            if (data.ok) {
              if (product) {
                recordPurchase(product.handle, reference, data.status || 'success');
              }

              closeAllModals();
              showToast('Payment verified. Guide unlocked.');

              if (product) {
                openGuide(product.handle);
              }

              try {
                history.replaceState({}, '', window.location.pathname);
              } catch (err) {
                // Ignore history errors.
              }
            } else {
              showToast(data.error || 'Payment verification failed.', true);
            }

            enableCheckoutButton();
          })
          .catch(function () {
            showToast('Payment verification failed.', true);
            enableCheckoutButton();
          });
      }

      function buildGuideContent(product) {
        var destination = destinationCatalog[product.destinationKey];

        var html = '<p>' + escapeHtml(product.description) + '</p>';

        html += '<div class="guide-notice">' +
          'Unlocked guide. Keep volatile details as confirmation prompts. Check current hours, tickets, access, weather, and transport on official sources.' +
          '</div>';

        if (destination && destination.routes) {
          html += '<h3>Route identities</h3>';

          for (var i = 0; i < destination.routes.length; i++) {
            var route = destination.routes[i];

            html += '<div class="guide-route">';
            html += '<h4>' + escapeHtml(route.title) + '</h4>';
            html += '<p><strong>Protects:</strong> ' + escapeHtml(route.protects) + '.</p>';
            html += '<p><strong>Gives up:</strong> ' + escapeHtml(route.givesUp) + '.</p>';

            html += '<ul>';

            for (var b = 0; b < route.blocks.length; b++) {
              html += '<li>' + escapeHtml(route.blocks[b]) + '</li>';
            }

            html += '</ul>';
            html += '</div>';
          }
        } else {
          html += '<p class="muted">Use the planner to shape the route, then replace this draft with your source-led content.</p>';
        }

        if (destination && destination.recovery) {
          html += '<h3>If this happens</h3><ul class="guide-list">';

          for (var r = 0; r < destination.recovery.length; r++) {
            html += '<li>' + escapeHtml(destination.recovery[r]) + '</li>';
          }

          html += '</ul>';
        }

        html += '<h3>Before you go checklist</h3>';
        html += '<ul class="guide-list">' +
          '<li>Confirm opening hours and last entry.</li>' +
          '<li>Check timed-entry availability.</li>' +
          '<li>Save offline maps and transport alternatives.</li>' +
          '<li>Choose one graceful cut before you leave.</li>' +
          '</ul>';

        return html;
      }

      function openGuide(handle) {
        var product = findProduct(handle);
        if (!product) return;

        if (!isPurchased(handle)) {
          showToast('Purchase the guide to unlock it.', true);
          return;
        }

        $('guideModalTitle').textContent = product.title;
        $('guideModalBody').innerHTML = buildGuideContent(product);

        openModal('guideModal');
      }

      function bindAuthForms() {
        var signInTab = $('authTabSignIn');
        var signUpTab = $('authTabSignUp');

        if (signInTab) {
          signInTab.onclick = function () {
            switchAuthTab('signin');
          };
        }

        if (signUpTab) {
          signUpTab.onclick = function () {
            switchAuthTab('signup');
          };
        }

        var signinForm = $('signinForm');

        if (signinForm) {
          signinForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            var email = getText('signinEmail');
            var password = getText('signinPassword');
            var submitButton = event.target.querySelector('button[type="submit"]');

            if (!isValidEmail(email) || password.length < 8) {
              $('signinError').textContent = 'Enter a valid email and password.';
              return;
            }

            $('signinError').textContent = '';
            setButtonLoading(submitButton, true, 'Signing in...');

            var err = await signIn(email, password);

            setButtonLoading(submitButton, false);

            if (err) {
              $('signinError').textContent = err;
              return;
            }

            signinForm.reset();
            closeAllModals();
            showToast('Welcome back.');
          });
        }

        var signupForm = $('signupForm');

        if (signupForm) {
          signupForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            var name = getText('signupName');
            var email = getText('signupEmail');
            var password = getText('signupPassword');
            var submitButton = event.target.querySelector('button[type="submit"]');

            if (name.length < 2) {
              $('signupError').textContent = 'Enter your name.';
              return;
            }

            if (!isValidEmail(email)) {
              $('signupError').textContent = 'Enter a valid email.';
              return;
            }

            if (password.length < 8) {
              $('signupError').textContent = 'Password must be at least 8 characters.';
              return;
            }

            $('signupError').textContent = '';
            setButtonLoading(submitButton, true, 'Creating account...');

            var err = await signUp(name, email, password);

            setButtonLoading(submitButton, false);

            if (err) {
              $('signupError').textContent = err;
              return;
            }

            signupForm.reset();
            closeAllModals();
            showToast('Account created.');
          });
        }

        var demoAuthBtn = $('demoAuthBtn');

        if (demoAuthBtn) {
          demoAuthBtn.onclick = async function () {
            await useDemoAccount();
          };
        }
      }

      function bindPlanForm() {
        var planForm = $('planForm');

        if (planForm) {
          planForm.addEventListener('submit', function (event) {
            event.preventDefault();
            generateItinerary();
          });
        }

        var destinationSelect = $('destination');

        if (destinationSelect) {
          destinationSelect.addEventListener('change', function () {
            var wrap = $('customDestinationWrap');
            if (!wrap) return;

            if (destinationSelect.value === 'custom') {
              wrap.classList.remove('hidden');
            } else {
              wrap.classList.add('hidden');
            }
          });
        }

        var savedItineraries = $('savedItineraries');

        if (savedItineraries) {
          savedItineraries.addEventListener('click', function (event) {
            var button = event.target.closest('button');
            if (!button) return;

            var id = button.getAttribute('data-id');
            var action = button.getAttribute('data-action');

            if (action === 'load') {
              var item = findItinerary(id);

              if (item) {
                state.currentItinerary = item;
                renderItinerary(item);
                scrollToElement('itineraryOutput');
              }
            }

            if (action === 'delete') {
              var list = getItineraries();
              var next = [];

              for (var i = 0; i < list.length; i++) {
                if (list[i].id !== id) {
                  next.push(list[i]);
                }
              }

              saveItineraries(next);
              renderSavedItineraries();
              showToast('Itinerary deleted.');
            }
          });
        }
      }

      function bindProductGrid() {
        var productGrid = $('productGrid');

        if (productGrid) {
          productGrid.addEventListener('click', function (event) {
            var button = event.target.closest('button');
            if (!button) return;

            var handle = button.getAttribute('data-product-handle');
            var action = button.getAttribute('data-action');

            if (action === 'buy') {
              openCheckout(handle);
            }

            if (action === 'open-guide') {
              openGuide(handle);
            }
          });
        }

        var checkoutButton = $('checkoutButton');

        if (checkoutButton) {
          checkoutButton.onclick = function () {
            startCheckout();
          };
        }

        var checkoutCancelButton = $('checkoutCancelButton');

        if (checkoutCancelButton) {
          checkoutCancelButton.onclick = function () {
            closeAllModals();
          };
        }
      }

      function bindContactAndLaunch() {
        var launchForm = $('launchForm');

        if (launchForm) {
          launchForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var email = getText('launchEmail');

            if (!isValidEmail(email)) {
              showToast('Enter a valid email.', true);
              return;
            }

            var list = readStore(LS_KEYS.launch, []);

            list.unshift({
              email: email,
              createdAt: new Date().toISOString()
            });

            if (list.length > 100) {
              list.length = 100;
            }

            writeStore(LS_KEYS.launch, list);
            launchForm.reset();
            showToast('You are on the launch list.');
          });
        }

        var contactForm = $('contactForm');

        if (contactForm) {
          contactForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var name = getText('contactName');
            var email = getText('contactEmail');
            var subject = getText('contactSubject');
            var message = getText('contactMessage');

            if (name.length < 2 || !isValidEmail(email) || subject.length < 3 || message.length < 10) {
              showToast('Please complete all contact fields.', true);
              return;
            }

            var payload = {
              name: name,
              email: email,
              subject: subject,
              message: message,
              createdAt: new Date().toISOString()
            };

            var localContacts = readStore(LS_KEYS.contacts, []);
            localContacts.unshift(payload);

            if (localContacts.length > 100) {
              localContacts.length = 100;
            }

            writeStore(LS_KEYS.contacts, localContacts);

            fetch(API_BASE + '/contact', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(payload)
            }).catch(function () {
              // Local copy already saved. Keep the experience smooth.
            });

            contactForm.reset();
            showToast('Message sent. TripMint support will reply before live checkout.');
          });
        }
      }

      function bindNavigation() {
        var scrollButtons = document.querySelectorAll('[data-scroll]');

        for (var i = 0; i < scrollButtons.length; i++) {
          scrollButtons[i].addEventListener('click', function () {
            var target = this.getAttribute('data-scroll');
            scrollToElement(target);
          });
        }

        document.addEventListener('click', function (event) {
          if (event.target && event.target.hasAttribute && event.target.hasAttribute('data-close')) {
            closeAllModals();
          }
        });

        document.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') {
            closeAllModals();
          }
        });
      }

      function init() {
        state.user = readStore(LS_KEYS.session, null);
        state.products = getProducts();

        renderAuthArea();
        renderProducts();
        renderSavedItineraries();

        bindNavigation();
        bindAuthForms();
        bindPlanForm();
        bindProductGrid();
        bindContactAndLaunch();

        loadConfig();
        ensureDemoUser();

        var checkoutReference = getQueryParameter('reference');
        var checkoutHandle = getQueryParameter('handle');

        if (checkoutReference) {
          var product = checkoutHandle ? findProduct(checkoutHandle) : null;
          verifyPayment(checkoutReference, product || state.products[0]);
        }
      }

      document.addEventListener('DOMContentLoaded', init);
    })();
  </script>
</body>
</html>`;

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', getBase(req));
    let pathname = url.pathname || '/';

    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    let route = pathname.startsWith('/api') ? pathname.slice(4) : pathname;

    if (!route) {
      route = '/';
    }

    if (route === '/health') {
      json(res, 200, {
        ok: true,
        service: 'TripMint',
        version: '1.0.0'
      });
      return;
    }

    if (route === '/config') {
      const readiness = getPaymentReadiness();

      json(res, 200, {
        paystackPublicKey: readiness.publicKey,
        mode: readiness.mode,
        checkoutEnabled: readiness.ready,
        merchantApproved: readiness.merchantApproved,
        version: '1.0.0'
      });
      return;
    }

    if (route === '/contact' && req.method === 'POST') {
      const body = await readBody(req);

      const name = clampText(body.name, 120);
      const email = clampText(body.email, 320).toLowerCase();
      const subject = clampText(body.subject, 160);
      const message = clampText(body.message, 4000);

      if (name.length < 2 || !isValidEmail(email) || subject.length < 3 || message.length < 10) {
        json(res, 400, {
          error: 'Please complete all fields.'
        });
        return;
      }

      memory.contacts.unshift({
        name: name,
        email: email,
        subject: subject,
        message: message,
        createdAt: new Date().toISOString()
      });

      trimList(memory.contacts, 200);

      json(res, 200, {
        ok: true
      });
      return;
    }

    if (route === '/paystack/initialize' && req.method === 'POST') {
      const body = await readBody(req);
      const readiness = getPaymentReadiness();

      if (!readiness.ready) {
        json(res, 200, {
          configured: false,
          error: 'Paystack is not configured yet.'
        });
        return;
      }

      const email = clampText(body.email, 320).toLowerCase();
      const amount = Number(body.amount);
      const productHandle = clampText(body.productHandle, 200);
      const title = clampText(body.title, 180);

      if (!isValidEmail(email)) {
        json(res, 400, {
          error: 'Enter a valid email.'
        });
        return;
      }

      if (!Number.isFinite(amount) || amount < 100) {
        json(res, 400, {
          error: 'Enter a valid payment amount.'
        });
        return;
      }

      const reference = 'tm_' + crypto.randomBytes(10).toString('hex');

      const payload = {
        email: email,
        amount: Math.round(amount),
        reference: reference,
        callback_url: getBase(req) + '/api/checkout/callback?reference=' + encodeURIComponent(reference) + '&handle=' + encodeURIComponent(productHandle),
        metadata: {
          productHandle: productHandle,
          title: title,
          custom_fields: [
            {
              display_name: 'Product',
              variable_name: 'product',
              value: productHandle || title || 'TripMint guide'
            }
          ]
        }
      };

      if (typeof fetch !== 'function') {
        json(res, 501, {
          error: 'Server fetch is not available.'
        });
        return;
      }

      try {
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + readiness.secretKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
          json(res, 502, {
            error: 'Paystack did not initialize the transaction.',
            details: data
          });
          return;
        }

        json(res, 200, {
          configured: true,
          authorization_url: data.data.authorization_url,
          access_code: data.data.access_code,
          reference: data.data.reference
        });
        return;
      } catch (err) {
        json(res, 502, {
          error: 'Could not reach Paystack.'
        });
        return;
      }
    }

    if (route === '/paystack/verify' && req.method === 'POST') {
      const body = await readBody(req);
      const reference = clampText(body.reference, 256);
      const productHandle = clampText(body.productHandle, 200);

      if (!reference) {
        json(res, 400, {
          error: 'Payment reference is required.'
        });
        return;
      }

      const readiness = getPaymentReadiness();

      if (!readiness.secretKey) {
        memory.purchases.unshift({
          reference: reference,
          productHandle: productHandle,
          status: 'demo',
          verifiedAt: new Date().toISOString()
        });

        trimList(memory.purchases, 200);

        json(res, 200, {
          ok: true,
          status: 'demo',
          message: 'Demo payment verified. Add PAYSTACK_SECRET_KEY to enable real verification.'
        });
        return;
      }

      if (typeof fetch !== 'function') {
        json(res, 501, {
          error: 'Server fetch is not available.'
        });
        return;
      }

      try {
        const response = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
          headers: {
            'Authorization': 'Bearer ' + readiness.secretKey
          }
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
          json(res, 502, {
            error: 'Paystack verification failed.',
            details: data
          });
          return;
        }

        const payment = data.data || {};

        if (payment.status !== 'success') {
          json(res, 402, {
            error: 'Payment was not successful.',
            status: payment.status
          });
          return;
        }

        memory.purchases.unshift({
          reference: reference,
          productHandle: productHandle || (payment.metadata && payment.metadata.productHandle) || '',
          status: 'success',
          amount: payment.amount,
          currency: payment.currency,
          email: payment.customer && payment.customer.email,
          verifiedAt: new Date().toISOString()
        });

        trimList(memory.purchases, 200);

        json(res, 200, {
          ok: true,
          status: 'success'
        });
        return;
      } catch (err) {
        json(res, 502, {
          error: 'Could not verify payment.'
        });
        return;
      }
    }

    if (route === '/paystack/webhook' && req.method === 'POST') {
      const readiness = getPaymentReadiness();
      const raw = await readRawBody(req);
      const signature = req.headers['x-paystack-signature'];

      if (!readiness.secretKey || !signature) {
        json(res, 400, {
          error: 'Webhook is not ready.'
        });
        return;
      }

      const expected = crypto.createHmac('sha512', readiness.secretKey).update(raw).digest('hex');

      if (expected !== signature) {
        json(res, 401, {
          error: 'Invalid webhook signature.'
        });
        return;
      }

      let event = {};

      try {
        event = JSON.parse(raw || '{}');
      } catch (err) {
        event = {};
      }

      if (event.event === 'charge.success' && event.data) {
        memory.purchases.unshift({
          reference: event.data.reference,
          status: 'success',
          amount: event.data.amount,
          currency: event.data.currency,
          email: event.data.customer && event.data.customer.email,
          productHandle: (event.data.metadata && event.data.metadata.productHandle) || '',
          verifiedAt: new Date().toISOString()
        });

        trimList(memory.purchases, 200);
      }

      json(res, 200, {
        ok: true
      });
      return;
    }

    if (route === '/checkout/callback') {
      htmlResponse(res, APP_HTML);
      return;
    }

    if (req.method === 'GET') {
      htmlResponse(res, APP_HTML);
      return;
    }

    json(res, 405, {
      error: 'Method not allowed.'
    });
  } catch (err) {
    json(res, 500, {
      error: 'Server error.',
      detail: process.env.NODE_ENV === 'development' ? String(err) : undefined
    });
  }
}

module.exports = handler;

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  const http = require('http');
  const port = process.env.PORT || 3000;

  http.createServer(handler).listen(port, function () {
    console.log('TripMint running on http://localhost:' + port);
  });
}
