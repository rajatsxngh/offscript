'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, ChevronDown, KeyRound, LoaderCircle, MessageCircle, ShieldCheck, Sparkles, Unplug } from 'lucide-react';
import type { AIProvider, AISettings, ChatGPTSignInStatus } from '@/lib/ai-settings';
import './ai-connection.css';

type Operation = 'save' | 'select' | 'sign-in' | 'disconnect' | 'cancel' | null;
type ConnectionProps = {
  onConnected: (settings: AISettings) => void;
  onSettingsChanged: (settings: AISettings) => void;
  onCancel: () => void;
};

async function connectionRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'We could not update your connection. Please try again.');
  return data as T;
}

export function AiConnection({ onConnected, onSettingsChanged, onCancel }: ConnectionProps) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [provider, setProvider] = useState<AIProvider>('chatgpt');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5.4-mini');
  const [chatgptModel, setChatGPTModel] = useState('');
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<Operation>(null);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const activePost = useRef<AbortController | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollController = useRef<AbortController | null>(null);
  const popup = useRef<Window | null>(null);
  const signInGeneration = useRef(0);
  const ownsSignIn = useRef(false);
  const callbacks = useRef({ onConnected, onSettingsChanged });
  callbacks.current = { onConnected, onSettingsChanged };
  const busy = operation !== null || pending;

  function stopPolling() {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = null;
    pollController.current?.abort();
    pollController.current = null;
  }

  function closePopup() {
    try { popup.current?.close(); } catch { /* The identity provider may isolate its window. */ }
    popup.current = null;
  }

  function applySettings(data: AISettings) {
    setSettings(data); setModel(data.apiKey.model); setChatGPTModel(data.chatgpt.model);
    callbacks.current.onSettingsChanged(data);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      signInGeneration.current += 1;
      activePost.current?.abort(); activePost.current = null;
      stopPolling(); closePopup();
      if (ownsSignIn.current) {
        ownsSignIn.current = false;
        void fetch('/api/ai/chatgpt', { method: 'DELETE', keepalive: true }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    void connectionRequest<AISettings>('/api/ai/settings', { signal: controller.signal }).then(data => {
      if (controller.signal.aborted || !mounted.current) return;
      applySettings(data);
      setProvider((data.configured || data.chatgpt.connected ? data.activeProvider : null) || 'chatgpt');
    }).catch(cause => {
      if (!controller.signal.aborted && mounted.current) setLoadError(cause instanceof Error ? cause.message : 'We could not check your AI connection.');
    }).finally(() => { if (!controller.signal.aborted && mounted.current) setLoading(false); });
    return () => controller.abort();
  }, [retry]);

  async function selectConnection(selectedProvider: AIProvider) {
    if (busy || !settings) return;
    const controller = new AbortController(); activePost.current = controller;
    setOperation('select'); setError(''); setNotice('');
    try {
      const data = await connectionRequest<AISettings>('/api/ai/settings', {
        method: 'PATCH', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider, ...(selectedProvider === 'chatgpt' ? { model: chatgptModel } : {}) }),
      });
      if (controller.signal.aborted || !mounted.current) return;
      applySettings(data);
      if (!data.configured) throw new Error('This connection is not ready yet. Please reconnect to continue.');
      setApiKey(''); callbacks.current.onConnected(data);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : 'We could not switch your connection.');
    } finally {
      if (activePost.current === controller) { activePost.current = null; if (mounted.current) setOperation(null); }
    }
  }

  async function connectAPI(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim() || !model.trim() || busy || !mounted.current) return;
    const controller = new AbortController(); activePost.current = controller;
    setOperation('save'); setError(''); setNotice('');
    try {
      const data = await connectionRequest<AISettings>('/api/ai/settings', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), model: model.trim() }),
      });
      if (controller.signal.aborted || !mounted.current) return;
      if (!data.configured) throw new Error('The provider did not confirm a connection. Please check your key and try again.');
      setApiKey(''); applySettings(data); callbacks.current.onConnected(data);
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) {
        const message = cause instanceof Error ? cause.message : 'We could not connect. Please try again.';
        setError(message.split(apiKey.trim()).join('[redacted]'));
      }
    } finally {
      if (activePost.current === controller) { activePost.current = null; if (mounted.current) setOperation(null); }
    }
  }

  async function cancelSignIn(message = '') {
    signInGeneration.current += 1;
    stopPolling(); closePopup(); activePost.current?.abort(); activePost.current = null;
    setPending(false); setOperation('cancel'); setError('');
    try {
      await connectionRequest('/api/ai/chatgpt', { method: 'DELETE' });
      ownsSignIn.current = false;
      if (mounted.current) setNotice(message || 'Sign-in cancelled. Your conversation is still here.');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'We could not cancel sign-in. It will expire automatically.');
    } finally { if (mounted.current) setOperation(null); }
  }

  function pollSignIn(generation: number, startedAt: number) {
    if (!mounted.current || signInGeneration.current !== generation) return;
    if (Date.now() - startedAt > 10 * 60_000) { void cancelSignIn('Sign-in timed out. Continue with ChatGPT to try again.'); return; }
    const controller = new AbortController(); pollController.current = controller;
    void connectionRequest<ChatGPTSignInStatus>('/api/ai/chatgpt', { signal: controller.signal }).then(async status => {
      if (!mounted.current || signInGeneration.current !== generation || controller.signal.aborted) return;
      if (status.status === 'connected') {
        const data = await connectionRequest<AISettings>('/api/ai/settings', { signal: controller.signal });
        if (!mounted.current || signInGeneration.current !== generation || controller.signal.aborted) return;
        ownsSignIn.current = false; closePopup(); setPending(false); setOperation(null); applySettings(data);
        if (data.activeProvider === 'chatgpt' && data.chatgpt.ready && data.configured) callbacks.current.onConnected(data);
        else setNotice('Signed in to ChatGPT. This account has not enabled plan usage for Offscript. You can reconnect to approve access or use your API key.');
        return;
      }
      if (status.status === 'error' || status.status === 'idle') {
        ownsSignIn.current = false; closePopup(); setPending(false); setOperation(null);
        setError(status.error?.message || 'Sign-in expired or was cancelled. Continue with ChatGPT to try again.');
        return;
      }
      setError('');
      pollTimer.current = setTimeout(() => pollSignIn(generation, startedAt), 1500);
    }).catch(cause => {
      if (!mounted.current || signInGeneration.current !== generation || controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'We could not check sign-in. We will check again.');
      pollTimer.current = setTimeout(() => pollSignIn(generation, startedAt), 3000);
    });
  }

  async function signIn() {
    if (busy) return;
    // Open synchronously from the click so browsers can allow the authorization window.
    const authWindow = window.open('about:blank', '_blank', 'popup,width=560,height=740');
    if (!authWindow) { setError('Allow pop-up windows for Offscript, then choose Continue with ChatGPT again. Your question is saved here.'); return; }
    authWindow.opener = null; popup.current = authWindow;
    const controller = new AbortController(); activePost.current = controller;
    const generation = ++signInGeneration.current;
    ownsSignIn.current = true;
    setOperation('sign-in'); setError(''); setNotice('');
    try {
      const data = await connectionRequest<{ authorizationUrl: string }>('/api/ai/chatgpt', { method: 'POST', signal: controller.signal });
      if (!mounted.current || signInGeneration.current !== generation || controller.signal.aborted) return;
      const url = new URL(data.authorizationUrl);
      if (url.origin !== 'https://auth.openai.com' || url.pathname !== '/api/accounts/authorize') throw new Error('The sign-in address could not be verified. Please try again.');
      authWindow.location.replace(url.href);
      setPending(true); setOperation(null); pollSignIn(generation, Date.now());
    } catch (cause) {
      if (!mounted.current || signInGeneration.current !== generation || controller.signal.aborted) return;
      closePopup(); setOperation(null); ownsSignIn.current = false;
      void fetch('/api/ai/chatgpt', { method: 'DELETE' }).catch(() => {});
      setError(cause instanceof Error ? cause.message : 'We could not open ChatGPT sign-in. Please try again.');
    } finally { if (activePost.current === controller) activePost.current = null; }
  }

  async function disconnectChatGPT() {
    if (busy) return;
    const controller = new AbortController(); activePost.current = controller;
    setOperation('disconnect'); setError(''); setNotice('');
    try {
      const result = await connectionRequest<{ revoked: boolean }>('/api/ai/chatgpt/disconnect', { method: 'POST', signal: controller.signal });
      const data = await connectionRequest<AISettings>('/api/ai/settings', { signal: controller.signal });
      if (controller.signal.aborted || !mounted.current) return;
      applySettings(data);
      setNotice(result.revoked
        ? 'ChatGPT is disconnected. Your conversations and saved API key are still here.'
        : 'ChatGPT was removed from this computer, but OpenAI could not confirm revocation. Remove Offscript in your ChatGPT account settings to finish disconnecting.');
    } catch (cause) {
      if (!controller.signal.aborted && mounted.current) setError(cause instanceof Error ? cause.message : 'We could not disconnect ChatGPT. Please try again.');
    } finally {
      if (activePost.current === controller) { activePost.current = null; if (mounted.current) setOperation(null); }
    }
  }

  return <div className="ai-connect">
    <div className="ai-connect-intro"><span className="ai-connect-symbol"><Sparkles size={21} /></span><div><h3>A little intelligence. Your way.</h3><p>Choose how you want to explore your ideas.</p></div></div>
    {loading && <div className="ai-connect-loading" role="status"><LoaderCircle size={15} className="spinner" />Checking your connections…</div>}
    {loadError && <div className="ai-connect-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Check again</button></div>}
    {!loading && settings && <>
      {settings.selectionError && <div className="ai-connect-error" role="alert">{settings.selectionError}</div>}
      <div className="ai-connect-choices" aria-label="AI connection options">
        {(['chatgpt', 'api-key'] as const).map(choice => {
          const connected = choice === 'chatgpt' ? settings.chatgpt.connected : settings.apiKey.configured;
          const active = settings.activeProvider === choice && settings.configured;
          return <button key={choice} type="button" className={`ai-connect-choice ${provider === choice ? 'is-selected' : ''}`} aria-pressed={provider === choice} disabled={busy} onClick={() => { setProvider(choice); setError(''); }}>
            <span className="ai-connect-choice-top">{choice === 'chatgpt' ? <MessageCircle size={18} /> : <KeyRound size={18} />}<span className={`ai-connect-choice-status ${active ? 'is-active' : ''}`}>{active ? <><Check size={10} />In use</> : connected ? 'Saved' : 'Connect'}</span></span>
            <strong>{choice === 'chatgpt' ? 'ChatGPT' : 'OpenAI API'}</strong><span>{choice === 'chatgpt' ? 'Use your ChatGPT plan' : 'Use your own API key'}</span>
          </button>;
        })}
      </div>
      <div className="ai-connect-panel">
        {provider === 'chatgpt' ? <>
          <div className="ai-connect-panel-heading"><h4>Your ChatGPT, in Offscript.</h4><p>Use your eligible ChatGPT plan for conversations here. Your existing ChatGPT chats stay private.</p></div>
          {settings.chatgpt.connected && <div className="ai-connect-account"><span><Check size={14} /></span><div><strong>{settings.chatgpt.accountLabel || 'ChatGPT account connected'}</strong><p>{settings.chatgpt.needsReauth ? 'Sign in again to continue using this account.' : settings.chatgpt.ready ? 'Ready for your next question.' : 'Plan access is not available for this connection.'}</p></div><button type="button" disabled={busy} onClick={() => void disconnectChatGPT()} aria-label="Disconnect ChatGPT" title="Disconnect ChatGPT">{operation === 'disconnect' ? <LoaderCircle size={15} className="spinner" /> : <Unplug size={15} />}</button></div>}
          {settings.chatgpt.ready && settings.chatgpt.models.length > 0 && <div className="ai-connect-chatgpt-model"><label htmlFor="chatgpt-model">Model</label><select id="chatgpt-model" value={chatgptModel} disabled={busy} onChange={event => setChatGPTModel(event.target.value)}>{settings.chatgpt.models.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p>Models available to this ChatGPT connection. Plan limits apply.</p></div>}
          {pending ? <div className="ai-connect-pending" role="status"><LoaderCircle size={20} className="spinner" /><div><strong>Finish signing in with ChatGPT.</strong><p>Approve access in the window that opened. Your map and question are waiting right here.</p><button type="button" onClick={() => void cancelSignIn()}>Cancel sign-in</button></div></div> : <div className="ai-connect-chatgpt-actions">
            {settings.chatgpt.ready ? <><button type="button" className="ai-connect-submit" disabled={busy || !chatgptModel} onClick={() => void selectConnection('chatgpt')}>{operation === 'select' ? <LoaderCircle size={16} className="spinner" /> : <MessageCircle size={16} />}{settings.activeProvider === 'chatgpt' ? 'Continue with ChatGPT' : 'Use ChatGPT'}</button><button type="button" className="ai-connect-text-button" disabled={busy} onClick={() => void signIn()}>Reconnect ChatGPT<ArrowUpRight size={12} /></button></> : <button type="button" className="ai-connect-submit" disabled={busy} onClick={() => void signIn()}>{operation === 'sign-in' ? <LoaderCircle size={16} className="spinner" /> : <MessageCircle size={16} />}{operation === 'sign-in' ? 'Opening secure sign-in…' : 'Continue with ChatGPT'}</button>}
          </div>}
        </> : <form onSubmit={connectAPI}>
          <div className="ai-connect-panel-heading"><h4>A direct connection to OpenAI.</h4><p>API usage is billed separately from your ChatGPT subscription.</p></div>
          {settings.apiKey.configured && <div className="ai-connect-existing"><span><Check size={14} /></span><div><strong>Your API key is saved</strong><p>{settings.apiKey.model}{settings.apiKey.source === 'environment' ? ' · Set up on this server' : ' · Saved on this computer'}</p><button type="button" className="ai-connect-use-current" disabled={busy} onClick={() => void selectConnection('api-key')}>{operation === 'select' ? <LoaderCircle size={12} className="spinner" /> : <ArrowUpRight size={12} />}{settings.activeProvider === 'api-key' ? 'Continue with API key' : 'Use saved API key'}</button></div></div>}
          <div className="ai-connect-label-row"><label htmlFor="openai-api-key">{settings.apiKey.configured ? 'Replace your API key' : 'OpenAI API key'}</label><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Get an API key<ArrowUpRight size={12} /></a></div>
          <div className="ai-connect-key"><KeyRound size={16} /><input id="openai-api-key" name="openai-api-key" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={settings.apiKey.configured ? 'Paste a replacement key' : 'Paste your API key'} disabled={busy} required aria-describedby="ai-key-help" /></div>
          <p id="ai-key-help" className="ai-connect-key-help">{settings.apiKey.configured ? 'A replacement is checked before it is saved. Your current key is never sent back to this browser.' : 'Your key stays on this computer, outside your notes and exports.'}</p>
          <details className="ai-connect-model"><summary><span>Model</span><span>{model || 'Choose a model'}<ChevronDown size={13} /></span></summary><div><label htmlFor="openai-model">Model ID</label><input id="openai-model" name="openai-model" value={model} onChange={event => setModel(event.target.value)} disabled={busy} autoComplete="off" spellCheck={false} required placeholder="gpt-5.4-mini" /><p>Choose a model available to your API account. Access is checked when you connect.</p></div></details>
          <button type="submit" className="ai-connect-submit" disabled={busy || !apiKey.trim() || !model.trim()}>{operation === 'save' ? <LoaderCircle size={15} className="spinner" /> : <KeyRound size={15} />}{operation === 'save' ? 'Checking connection…' : settings.apiKey.configured ? 'Save and use new key' : 'Connect API key'}</button>
        </form>}
      </div>
      {notice && <div className="ai-connect-notice" role="status">{notice}</div>}
      {error && <div className="ai-connect-error" role="alert">{error}</div>}
      <div className="ai-connect-privacy"><ShieldCheck size={16} /><p>Questions and relevant node context are sent to OpenAI. Both connections can stay saved; only the one you choose is used.</p></div>
      <div className="ai-connect-actions"><span>{settings.configured ? <><span className="ai-connect-active-dot" />Using {settings.activeProvider === 'chatgpt' ? 'ChatGPT' : 'OpenAI API'}</> : 'Choose a connection to begin.'}</span><button type="button" className="ai-connect-cancel" onClick={onCancel}>Close</button></div>
    </>}
  </div>;
}
