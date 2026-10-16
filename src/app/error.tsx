'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#F7F5F0', color: '#202522', padding: 24 }}>
    <div style={{ maxWidth: 440 }}>
      <p style={{ color: '#245B4A', fontWeight: 600 }}>offscript</p>
      <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400 }}>Let’s pick up the thread.</h1>
      <p>The workspace couldn’t open. Your saved notebook is still in the local database. Try loading it again.</p>
      <button onClick={reset} style={{ background: '#245B4A', color: 'white', border: 0, borderRadius: 8, padding: '12px 20px', cursor: 'pointer' }}>Try again</button>
    </div>
  </main>;
}
