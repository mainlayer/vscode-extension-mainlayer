# VS Code Extension — Mainlayer Template

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/my-publisher.vscode-extension-mainlayer?label=VS%20Code%20Marketplace&logo=visual-studio-code&logoColor=white&color=007ACC)](https://marketplace.visualstudio.com/items?itemName=my-publisher.vscode-extension-mainlayer)
[![CI](https://github.com/my-org/vscode-extension-mainlayer/actions/workflows/ci.yml/badge.svg)](https://github.com/my-org/vscode-extension-mainlayer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-ready VS Code extension template that gates premium features behind a [Mainlayer](https://mainlayer.fr) subscription without writing payment processing code yourself. Free features always available; premium features unlock instantly upon subscription.

---

## Features

| Feature | Free | Premium |
|---------|:----:|:-------:|
| Core analysis & editing | ✓ | ✓ |
| Premium commands | | ✓ |
| Priority support | | ✓ |
| Early access to new features | | ✓ |

---

## 5-Minute Setup Guide

### 1. Install the extension

Search for **My Extension (Mainlayer)** in the VS Code Marketplace:

```bash
code --install-extension my-publisher.vscode-extension-mainlayer
```

### 2. Get a Mainlayer API key

1. Visit [mainlayer.fr](https://mainlayer.fr) and sign up
2. Create a new project in your dashboard
3. Copy your **API key**

### 3. Add API key to VS Code

Press `Cmd/Ctrl + ,` to open settings, search for **Mainlayer API Key**, and paste:

```json
{
  "myExtension.mainlayerApiKey": "ml_live_xxxxxxxxxxxxx"
}
```

Or use the Command Palette (`Cmd/Ctrl + Shift + P`) and run:

```
My Extension: Set Mainlayer API Key
```

That's it! Free features work immediately. Premium features unlock when you add your Mainlayer subscription.

---

## Commands Reference

| Command | Description | Access |
|---------|-------------|--------|
| `My Extension: Run Free Feature` | Available to all users | Free |
| `My Extension: Run Premium Feature` | Advanced analysis and features | Premium |
| `My Extension: Set Mainlayer API Key` | Configure Mainlayer authentication | Free |
| `My Extension: Refresh Entitlements` | Re-check subscription status | Free |

---

## Upgrading to Premium

1. Run **My Extension: Run Premium Feature**
2. Click **Upgrade Now** in the prompt
3. Complete payment on mainlayer.fr
4. Run **My Extension: Refresh Entitlements** (or wait 30 seconds)
5. Premium features unlock immediately

**Alternative**: Visit [mainlayer.fr/pricing](https://mainlayer.fr/pricing) directly to upgrade your subscription.

No credit card data is stored locally — all billing is handled securely by Mainlayer.

---

## Architecture

```
src/
├── extension.ts       # Main entry point & command registration
├── mainlayer.ts       # HTTP client for Mainlayer API
├── entitlement.ts     # Entitlement checks with 2-layer caching
├── upgrade.ts         # Upgrade prompts & API key flow
└── webview.ts         # In-editor upgrade panel
tests/suite/
└── extension.test.ts  # Mocha unit tests
```

### Performance & Caching

Entitlements are cached at two levels to minimize API calls:

- **Session cache**: 5 minutes in-memory (cleared on window reload)
- **Global state**: Persists across sessions as fallback when API is unreachable
- **Result**: Premium feature checks complete in <10ms after first check

---

## Development

### Clone and setup

```bash
git clone https://github.com/my-org/vscode-extension-mainlayer
cd vscode-extension-mainlayer
npm ci
```

### Commands

```bash
npm run watch        # Compile with file watching
npm run build        # Production build
npm run lint         # TypeScript & linting checks
npm test             # Run Mocha tests (requires VS Code)
npm run package      # Create .vsix for Marketplace
```

### Debug locally

1. Open the repo in VS Code
2. Press `F5` to launch **Extension Development Host**
3. Use Command Palette in dev window to test commands
4. Set breakpoints in `src/extension.ts` to debug

---

## Settings

| Setting | Type | Required | Description |
|---------|------|----------|-------------|
| `myExtension.mainlayerApiKey` | string | No | Mainlayer API key for premium features (stored securely in VS Code settings) |

---

## Security

- **API keys**: Stored securely in VS Code's settings, never in source control
- **Network**: All communication via TLS to `https://api.mainlayer.fr`
- **WebView**: Strict Content Security Policy with per-render cryptographic nonces
- **No telemetry**: Extension does not collect usage data beyond Mainlayer's billing

---

## Troubleshooting

**Premium features show "Upgrade" even with subscription?**
- Run "Refresh Entitlements" from Command Palette
- Verify API key is correct in Settings
- Check your Mainlayer dashboard subscription status

**API key rejected?**
- Copy the full key from your Mainlayer dashboard (no extra spaces)
- Verify the key starts with `ml_live_` (not `ml_test_`)

**Getting rate-limited?**
- Entitlements are cached for 5 minutes; checks after that hit the API
- Max 1 API call per 5 minutes per feature is normal

---

## Support & Documentation

- **Mainlayer docs**: https://docs.mainlayer.fr
- **Report issues**: https://github.com/my-org/vscode-extension-mainlayer/issues
- **Mainlayer support**: https://mainlayer.fr/support

---

## License

MIT License. See [LICENSE](LICENSE).
