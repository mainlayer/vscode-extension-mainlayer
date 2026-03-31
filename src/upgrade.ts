import * as vscode from 'vscode'
import { MainlayerClient } from './mainlayer'
import { PaymentWebviewPanel } from './webview'

export interface UpgradeOptions {
  /** The Mainlayer feature identifier the user needs to unlock. */
  feature: string
  /** Human-readable label shown in the upgrade prompt. */
  featureLabel?: string
}

/**
 * Show a VS Code information message prompting the user to upgrade, then
 * optionally open the payment webview.
 */
export async function showUpgradePrompt(
  client: MainlayerClient,
  options: UpgradeOptions = { feature: 'premium' }
): Promise<void> {
  const { feature, featureLabel = 'Premium' } = options

  const choice = await vscode.window.showInformationMessage(
    `This is a ${featureLabel} feature. Upgrade to unlock it.`,
    'Upgrade Now',
    'Learn More',
    'Not Now'
  )

  if (choice === 'Upgrade Now') {
    await openUpgradeWebview(client, feature)
  } else if (choice === 'Learn More') {
    await vscode.env.openExternal(vscode.Uri.parse('https://mainlayer.xyz/pricing'))
  }
}

/**
 * Open the in-editor payment webview panel.
 */
export async function openUpgradeWebview(
  client: MainlayerClient,
  feature: string
): Promise<void> {
  try {
    const tiers = await client.getPricingTiers()
    PaymentWebviewPanel.createOrShow(client, feature, tiers)
  } catch {
    // If pricing data cannot be fetched, fall back to the external page
    void vscode.window.showErrorMessage(
      'Unable to load pricing information. Opening Mainlayer pricing page instead.'
    )
    await vscode.env.openExternal(vscode.Uri.parse('https://mainlayer.xyz/pricing'))
  }
}

/**
 * Guide the user through entering their API key after purchase.
 */
export async function promptForApiKey(): Promise<string | undefined> {
  const key = await vscode.window.showInputBox({
    title: 'Enter your Mainlayer API Key',
    prompt:
      'Paste the API key from your Mainlayer dashboard. It will be stored in VS Code settings.',
    placeHolder: 'ml_live_...',
    password: true,
    ignoreFocusOut: true,
    validateInput(value) {
      if (!value || value.trim().length === 0) {
        return 'API key cannot be empty'
      }
      return undefined
    },
  })

  if (key) {
    const trimmed = key.trim()
    await vscode.workspace
      .getConfiguration('myExtension')
      .update('mainlayerApiKey', trimmed, vscode.ConfigurationTarget.Global)

    void vscode.window.showInformationMessage('Mainlayer API key saved. Premium features unlocked!')
    return trimmed
  }
  return undefined
}
