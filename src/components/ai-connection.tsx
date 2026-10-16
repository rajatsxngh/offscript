'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, ChevronDown, KeyRound, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';
import './ai-connection.css';

type ConnectionSettings = { configured: boolean; model: string; source: 'local' | 'environment' | null };
type SettingsResponse = ConnectionSettings & { error?: { message?: string } };

export function AiConnection({ onConnected, onCancel }: { onConnected: () => void; onCancel: () => void }) {
  const [settings, setSettings] = useState<ConnectionSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-5.4-mini');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const keyRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const activePost = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activePost.current?.abort();
      activePost.current = null;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setLoadError('');
    async function load() {
      try {
        const response = await fetch('/api/ai/settings', { signal: controller.signal, cache: 'no-store' });
        const data: SettingsResponse = await response.json();
        if (controller.signal.aborted || !mounted.current) return;
        if (!response.ok) throw new Error(data.error?.message || 'We could not check your AI connection.');
        setSettings(data);
        if (data.model) setModel(data.model);
      } catch (cause) {
        if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'We could not check your AI connection.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => { if (!loading && !settings?.configured) keyRef.current?.focus(); }, [loading, settings?.configured]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim() || !model.trim() || busy || !mounted.current) return;
    activePost.current?.abort();
    const controller = new AbortController();
    activePost.current = controller;
    const isCurrent = () => mounted.current && activePost.current === controller && !controller.signal.aborted;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/ai/settings', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim(), model: model.trim() }) });
      const data: SettingsResponse = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(data.error?.message || 'The connection could not be saved. Check your key and model, then try again.');
      if (!data.configured) throw new Error('The provider did not confirm a connection. Please check your key and try again.');
      setApiKey(''); setSettings(data); onConnected();
    } catch (cause) {
      if (!isCurrent()) return;
      const message = cause instanceof Error ? cause.message : 'We could not connect. Please try again.';
      setError(apiKey.trim() ? message.split(apiKey.trim()).join('[redacted]') : message);
    } finally { if (isCurrent()) { activePost.current = null; setBusy(false); } }
  }

  return <div className="ai-connect">
    <div className="ai-connect-intro"><span className="ai-connect-symbol"><Sparkles size={21} /></span><div><h3>Bring your questions to life.</h3><p>Connect OpenAI to talk through ideas in any topic.</p></div></div>
    {loading && <div className="ai-connect-loading" role="status"><LoaderCircle size={15} className="spinner" />Checking your connection…</div>}
    {loadError && <div className="ai-connect-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Check again</button></div>}
    {!loading && settings?.configured && <div className="ai-connect-existing"><span><Check size={15} /></span><div><strong>OpenAI is connected</strong><p>{settings.model}{settings.source === 'environment' ? ' · Set up on this server' : ' · Saved on this computer'}</p><button type="button" className="ai-connect-use-current" disabled={busy} onClick={() => { if (mounted.current && !busy) { setApiKey(''); onConnected(); } }}>Continue with this connection<ArrowUpRight size={12} /></button></div></div>}
    <form onSubmit={connect}>
      <div className="ai-connect-label-row"><label htmlFor="openai-api-key">{settings?.configured ? 'Replace your API key' : 'OpenAI API key'}</label><a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">Get an API key<ArrowUpRight size={12} /></a></div>
      <div className="ai-connect-key"><KeyRound size={16} /><input ref={keyRef} data-autofocus id="openai-api-key" name="openai-api-key" type="password" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder={settings?.configured ? 'Paste a new key to replace your connection' : 'Paste your API key'} disabled={loading || busy} required aria-describedby="ai-key-help" /></div>
      <p id="ai-key-help" className="ai-connect-key-help">{settings?.configured ? 'Your current key is never sent back to this browser. A replacement is checked before it is saved.' : 'Use a key from your OpenAI API account. API usage is billed separately from a ChatGPT subscription.'}</p>
      <details className="ai-connect-model"><summary><span>Model</span><span>{model || 'Choose a model'}<ChevronDown size={13} /></span></summary><div><label htmlFor="openai-model">Model ID</label><input id="openai-model" name="openai-model" value={model} onChange={event => setModel(event.target.value)} disabled={loading || busy} autoComplete="off" spellCheck={false} required placeholder="gpt-5.4-mini" /><p>Choose a model available to your API account. Offscript checks access when you connect.</p></div></details>
      <div className="ai-connect-privacy"><ShieldCheck size={16} /><p>Your key is saved on this computer, outside your notes and exports. Questions and relevant topic context are sent to OpenAI.</p></div>
      {error && <div className="ai-connect-error" role="alert">{error}</div>}
      <div className="ai-connect-actions"><button type="button" className="ai-connect-cancel" onClick={() => { activePost.current?.abort(); activePost.current = null; setBusy(false); setApiKey(''); onCancel(); }}>Cancel</button><button type="submit" className="ai-connect-submit" disabled={loading || busy || !apiKey.trim() || !model.trim()}>{busy ? <LoaderCircle size={15} className="spinner" /> : <Sparkles size={15} />}{busy ? 'Checking connection…' : settings?.configured ? 'Update connection' : 'Connect OpenAI'}</button></div>
    </form>
  </div>;
}
