import * as vscode from 'vscode'
import { MainlayerClient, PricingTier } from './mainlayer'
import { promptForApiKey } from './upgrade'

type WebviewMessage =
  | { command: 'openExternal'; url: string }
  | { command: 'enterApiKey' }
  | { command: 'dismiss' }

export class PaymentWebviewPanel {
  public static readonly viewType = 'mainlayer.upgrade'
  private static instance: PaymentWebviewPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly client: MainlayerClient
  private readonly feature: string
  private readonly tiers: PricingTier[]
  private disposables: vscode.Disposable[] = []

  private constructor(
    panel: vscode.WebviewPanel,
    client: MainlayerClient,
    feature: string,
    tiers: PricingTier[]
  ) {
    this.panel = panel
    this.client = client
    this.feature = feature
    this.tiers = tiers

    this.panel.webview.html = this.buildHtml()
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewMessage) => this.handleMessage(msg),
      null,
      this.disposables
    )
  }

  public static createOrShow(
    client: MainlayerClient,
    feature: string,
    tiers: PricingTier[]
  ): PaymentWebviewPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined

    if (PaymentWebviewPanel.instance) {
      PaymentWebviewPanel.instance.panel.reveal(column)
      return PaymentWebviewPanel.instance
    }

    const panel = vscode.window.createWebviewPanel(
      PaymentWebviewPanel.viewType,
      'Upgrade to Premium',
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    )

    PaymentWebviewPanel.instance = new PaymentWebviewPanel(panel, client, feature, tiers)
    return PaymentWebviewPanel.instance
  }

  public dispose(): void {
    PaymentWebviewPanel.instance = undefined
    this.panel.dispose()
    for (const d of this.disposables) {
      d.dispose()
    }
    this.disposables = []
  }

  // -------------------------------------------------------------------------
  // Message handling
  // -------------------------------------------------------------------------

  private async handleMessage(msg: WebviewMessage): Promise<void> {
    switch (msg.command) {
      case 'openExternal':
        await vscode.env.openExternal(vscode.Uri.parse(msg.url))
        break

      case 'enterApiKey':
        await promptForApiKey()
        this.dispose()
        break

      case 'dismiss':
        this.dispose()
        break
    }
  }

  // -------------------------------------------------------------------------
  // HTML generation
  // -------------------------------------------------------------------------

  private buildHtml(): string {
    const nonce = getNonce()
    const tierCards = this.tiers.length > 0 ? this.tiers.map(renderTierCard).join('\n') : DEFAULT_TIER_CARDS

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Upgrade to Premium</title>
  <style nonce="${nonce}">
    :root {
      --accent: #7C3AED;
      --accent-hover: #6D28D9;
      --surface: var(--vscode-editor-background);
      --text: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: var(--vscode-editorGroup-border);
      --card-bg: var(--vscode-sideBar-background);
      --btn-fg: #ffffff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: var(--vscode-font-size, 14px);
      color: var(--text);
      background: var(--surface);
      padding: 32px 24px;
      max-width: 780px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 40px;
    }

    header .badge {
      display: inline-block;
      background: var(--accent);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-radius: 99px;
      padding: 3px 12px;
      margin-bottom: 12px;
    }

    header h1 {
      font-size: 26px;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 10px;
    }

    header p {
      color: var(--muted);
      line-height: 1.6;
    }

    .tiers {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 36px;
    }

    .tier-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px 20px;
      flex: 1 1 220px;
      max-width: 260px;
    }

    .tier-card.featured {
      border-color: var(--accent);
    }

    .tier-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }

    .tier-price {
      font-size: 30px;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .tier-interval {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 16px;
    }

    .tier-features {
      list-style: none;
      margin-bottom: 20px;
    }

    .tier-features li {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 6px;
      color: var(--muted);
    }

    .tier-features li::before {
      content: "✓";
      color: var(--accent);
      font-weight: 700;
      flex-shrink: 0;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      padding: 10px 18px;
      width: 100%;
      transition: opacity 0.15s;
    }

    .btn:hover { opacity: 0.88; }
    .btn:active { opacity: 0.75; }

    .btn-primary {
      background: var(--accent);
      color: var(--btn-fg);
    }

    .btn-secondary {
      background: transparent;
      color: var(--accent);
      border: 1px solid var(--accent);
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      align-items: center;
    }

    .actions .btn {
      max-width: 320px;
    }

    .divider {
      border: none;
      border-top: 1px solid var(--border);
      margin: 32px 0;
    }

    footer {
      text-align: center;
      color: var(--muted);
      font-size: 12px;
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <header>
    <div class="badge">Mainlayer</div>
    <h1>Unlock Premium Features</h1>
    <p>You've reached a premium feature. Choose a plan to continue<br>and get full access instantly.</p>
  </header>

  <div class="tiers">
    ${tierCards}
  </div>

  <hr class="divider">

  <div class="actions">
    <button class="btn btn-primary" onclick="openPricing()">View All Plans on Mainlayer</button>
    <button class="btn btn-secondary" onclick="enterKey()">I already have an API key</button>
    <button class="btn" style="color:var(--muted)" onclick="dismiss()">Maybe later</button>
  </div>

  <hr class="divider">

  <footer>
    Payments and licensing are handled securely by
    <a href="#" onclick="openExternal('https://mainlayer.xyz'); return false;">Mainlayer</a>.
    Your VS Code data is never shared.
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    function openPricing() {
      vscode.postMessage({ command: 'openExternal', url: 'https://mainlayer.xyz/pricing' });
    }

    function enterKey() {
      vscode.postMessage({ command: 'enterApiKey' });
    }

    function dismiss() {
      vscode.postMessage({ command: 'dismiss' });
    }

    function openExternal(url) {
      vscode.postMessage({ command: 'openExternal', url });
    }
  </script>
</body>
</html>`
  }
}

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function renderTierCard(tier: PricingTier): string {
  const price =
    tier.price === 0
      ? 'Free'
      : `$${(tier.price / 100).toFixed(tier.price % 100 === 0 ? 0 : 2)}`
  const interval = tier.interval === 'one_time' ? 'one-time' : `/ ${tier.interval}`
  const featureItems = tier.features
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join('\n')

  const isFeatured = tier.name.toLowerCase().includes('pro') || tier.price > 0

  return /* html */ `
    <div class="tier-card${isFeatured ? ' featured' : ''}">
      <div class="tier-name">${escapeHtml(tier.name)}</div>
      <div class="tier-price">${escapeHtml(price)}</div>
      <div class="tier-interval">${escapeHtml(interval)}</div>
      <ul class="tier-features">
        ${featureItems}
      </ul>
    </div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const DEFAULT_TIER_CARDS = /* html */ `
  <div class="tier-card">
    <div class="tier-name">Free</div>
    <div class="tier-price">$0</div>
    <div class="tier-interval">forever</div>
    <ul class="tier-features">
      <li>Core commands</li>
      <li>Community support</li>
    </ul>
  </div>
  <div class="tier-card featured">
    <div class="tier-name">Pro</div>
    <div class="tier-price">$9</div>
    <div class="tier-interval">/ month</div>
    <ul class="tier-features">
      <li>All free features</li>
      <li>Premium commands</li>
      <li>Priority support</li>
      <li>Early access to new features</li>
    </ul>
  </div>`
