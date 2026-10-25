import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { ScanLine, Loader2, Check, X } from 'lucide-react';
import { identifyLabel } from '@/lib/label.functions';
import type { MachineIdentity } from '@/lib/repair-record';
import { PhotoThumb, usePhotoPicker } from './photo';
import { Btn } from './ui';

export function LabelScanner({ onConfirm }: { onConfirm: (identity: MachineIdentity | null) => void }) {
  const pic = usePhotoPicker();
  const scan = useServerFn(identifyLabel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState<MachineIdentity | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  async function read() {
    if (!pic.photo) return;
    setBusy(true); setError(''); onConfirm(null); setConfirmed(false);
    try { const r = await scan({ data: { image: pic.photo.base64 } }); if (r.identity) setIdentity(r.identity); else setError(r.error ?? 'Could not read the label.'); }
    catch { setError('Could not scan the label. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 border-y border-border py-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg">Machine model label</h2><Btn variant="outline" aria-label="Upload model label" onClick={pic.open} disabled={busy}><ScanLine className="size-5" />{pic.photo ? 'Replace' : 'Scan label'}</Btn></div>
    {pic.input}
    {pic.photo && <div className="mt-3"><PhotoThumb photo={pic.photo} onRemove={() => { pic.setPhoto(null); setIdentity(null); setConfirmed(false); onConfirm(null); }} /><Btn onClick={read} disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />}{busy ? 'Reading label…' : 'Read make & model'}</Btn></div>}
    {(error || pic.error) && <p role="alert" className="mt-3 text-sm text-destructive">{error || pic.error}</p>}
    {identity && <div className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">Label confidence: {identity.confidence}. Confirm the details before continuing.</p>
      <label className="block text-sm">Make<input aria-label="Machine make" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3" value={identity.make} onChange={e => { setIdentity({ ...identity, make: e.target.value }); setConfirmed(false); onConfirm(null); }} /></label>
      <label className="block text-sm">Model<input aria-label="Machine model" className="mt-1 min-h-11 w-full rounded-lg border border-border bg-card px-3" value={identity.model} onChange={e => { setIdentity({ ...identity, model: e.target.value }); setConfirmed(false); onConfirm(null); }} /></label>
      <Btn disabled={!identity.make.trim() || !identity.model.trim()} onClick={() => { onConfirm(identity); setConfirmed(true); pic.setPhoto(null); }}><Check className="size-4" />{confirmed ? 'Model confirmed' : 'Use this model'}</Btn>
      {confirmed && <Btn variant="ghost" aria-label="Clear model" onClick={() => { setIdentity(null); setConfirmed(false); onConfirm(null); }}><X className="size-4" /></Btn>}
    </div>}
  </section>;
}