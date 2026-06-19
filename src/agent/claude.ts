import Anthropic from '@anthropic-ai/sdk'; // Import the official Anthropic SDK class for calling Claude API
import * as vscode from 'vscode'; // Import the VS Code extension API (UI, secrets, settings, etc.)

let client: Anthropic | null = null; // Module-level cache: holds a single reusable Anthropic client instance (null until first created)

// ── Shared API Key Retrieval ─────────────────────────────────────────
// Single source of truth for getting the Anthropic API key.
// Used by both getClient() (raw SDK) and runner.ts (Agent SDK).
// Checks three places in order: secret storage → env var → user popup.
export async function getApiKey(secretStorage: vscode.SecretStorage): Promise<string> {
  let apiKey = await secretStorage.get('anthropic-api-key');   // 1st: check VS Code's encrypted secret storage
  if (!apiKey) {
    apiKey = process.env.ANTHROPIC_API_KEY;   // 2nd: check the system environment variable
  }
  if (!apiKey) {
    // 3rd: no key found anywhere — ask the user directly via a VS Code input popup
    const input = await vscode.window.showInputBox({
      prompt: 'Enter your Anthropic API key',
      password: true,
      placeHolder: 'sk-ant-...',
      ignoreFocusOut: true,
    });
    if (!input) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY or enter it when prompted.');
    }
    apiKey = input;
    await secretStorage.store('anthropic-api-key', apiKey);   // Save it so they won't be asked again
  }
  return apiKey;
}

/**
 * Get or create the Anthropic API client.
 * save connection overhead, and avoid repeatedly creating http client and resolving the api issue
 */
export async function getClient(
  secretStorage: vscode.SecretStorage
): Promise<Anthropic> {
  if (client) {           // If we already created a client earlier in this session...
    return client;        // ...reuse it (singleton pattern)
  }
  const apiKey = await getApiKey(secretStorage);   // Use the shared key retrieval function
  client = new Anthropic({ apiKey });              // Create a new Anthropic SDK client
  return client;
}

/**
 * Reset the cached client (e.g. when the API key changes).
 */
export function resetClient(): void { // Exported sync function — clears the cached client so the next call to getClient creates a fresh one
  client = null; // Set the cache to null; next getClient() call will re-read the key and create a new client
}

/**
 * Send a message to Claude with tool definitions and stream the response.
 */
export async function sendMessage( // Exported async function — sends a conversation to Claude and returns the full response
  anthropicClient: Anthropic, // The Anthropic SDK client to use for the API call
  options: { // Configuration object for this request
    system?: string; // Optional system prompt that sets Claude's behavior/persona
    messages: Anthropic.MessageParam[]; // Array of conversation messages (user/assistant turns) — required
    tools?: Anthropic.Tool[]; // Optional array of tool definitions Claude can call (e.g. file read/write)
    maxTokens?: number; // Optional cap on how many tokens Claude can generate in its reply
    onText?: (text: string) => void; // Optional callback invoked with each text chunk from the response
  }
): Promise<Anthropic.Message> { // Returns a Promise resolving to the full Claude Message object
  const response = await anthropicClient.messages.create({ // Call the Anthropic Messages API and wait for the complete response
    model: 'claude-sonnet-4-6-20250514', // Use Claude Sonnet 4.6 (latest Sonnet) as the model
    max_tokens: options.maxTokens ?? 4096, // Use provided max tokens, or default to 4096 if not specified
    system: options.system ?? 'You are a helpful coding assistant working within the Zygote VS Code extension. You can read and write files in the user\'s workspace.', // Use provided system prompt, or a sensible default
    messages: options.messages, // Pass the conversation history to Claude
    tools: options.tools, // Pass tool definitions (may be undefined, which means no tools)
  });

  // Emit text blocks to the callback if provided
  if (options.onText) { // If the caller provided a text callback...
    for (const block of response.content) { // Iterate over each content block in Claude's response
      if (block.type === 'text') { // If this block is a text block (not a tool_use block)...
        options.onText(block.text); // ...invoke the callback with the text content
      }
    }
  }

  return response; // Return the full response object so the caller can inspect tool_use blocks, stop reason, etc.
}


//
// 1. should we switch other sdk and explore ther nodel sophisticateuoi,, and multimmodel here if it is the concerrn
// 2. but the reframe of the arrary of the systerm for later on
// 3, claude sonnet 4 is just too weak. I think we have to adapt to the better model currently?
///