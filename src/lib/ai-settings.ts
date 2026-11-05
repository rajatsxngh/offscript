export type AIProvider = 'chatgpt' | 'api-key';
export type APIKeySettings = { configured: boolean; model: string; source: 'local' | 'environment' | null };
export type ChatGPTModel = { id: string; name: string };
export type ChatGPTSettings = {
  connected: boolean;
  ready: boolean;
  needsReauth: boolean;
  planEnabled: boolean;
  accountLabel: string | null;
  model: string;
  models: ChatGPTModel[];
};
export type AISettings = APIKeySettings & {
  activeProvider: AIProvider | null;
  selectionError?: string;
  apiKey: APIKeySettings;
  chatgpt: ChatGPTSettings;
};
export type ChatGPTSignInStatus = {
  status: 'idle' | 'pending' | 'connected' | 'error';
  error?: { message: string };
};
