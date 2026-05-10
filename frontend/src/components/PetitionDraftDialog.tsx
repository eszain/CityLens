'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatPetitionDate,
  requestPetitionDraft,
  type PetitionDoc,
  type PetitionMeta,
} from '@/lib/petition';
import type { Block } from '@/types';

interface Props {
  block: Block;
  onPetitionReady: (doc: PetitionDoc) => void;
}

function PetitionDraftButtonImpl({ block, onPetitionReady }: Props) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          marginTop: 12,
          width: '100%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          background: 'var(--cl-green-700)',
          color: 'var(--cl-on-accent)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px',
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.02em',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        className="hover:bg-[var(--cl-green-800)]"
      >
        <Sparkles size={13} aria-hidden />
        Draft plan
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        {open && (
          <PetitionDraftDialogContent
            block={block}
            onPetitionReady={(doc) => {
              onPetitionReady(doc);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}

export const PetitionDraftButton = memo(PetitionDraftButtonImpl);

interface DialogContentProps {
  block: Block;
  onPetitionReady: (doc: PetitionDoc) => void;
  onCancel: () => void;
}

function PetitionDraftDialogContent({
  block,
  onPetitionReady,
  onCancel,
}: DialogContentProps) {
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateCreatedIso = useMemo(() => new Date().toISOString(), []);
  const dateLabel = useMemo(
    () => formatPetitionDate(dateCreatedIso),
    [dateCreatedIso],
  );

  const canSubmit = targetAudience.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const meta: PetitionMeta = {
      name: name.trim(),
      organization: organization.trim(),
      targetAudience: targetAudience.trim(),
      dateCreated: dateCreatedIso,
    };
    try {
      const doc = await requestPetitionDraft(meta, block);
      onPetitionReady(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setSubmitting(false);
    }
  }

  return (
    <DialogContent showCloseButton={!submitting}>
      <DialogHeader>
        <DialogTitle>Draft a petition</DialogTitle>
        <DialogDescription>
          Claude Haiku will draft a petition based on the AI analysis of{' '}
          <strong>{block.name}</strong>. You can edit and download the result
          as a PDF in the right panel.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field
            label="Your name"
            optional
            value={name}
            onChange={setName}
            placeholder="(optional)"
            disabled={submitting}
          />
          <Field
            label="Organization"
            optional
            value={organization}
            onChange={setOrganization}
            placeholder="(optional)"
            disabled={submitting}
          />
          <Field
            label="Target audience"
            required
            value={targetAudience}
            onChange={setTargetAudience}
            placeholder="e.g. City Councillor Mike Layton"
            disabled={submitting}
          />
          <ReadOnlyField label="Date created" value={dateLabel} />
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              fontSize: 12,
              color: 'var(--cl-red-400)',
              background: 'rgba(216, 102, 76, 0.08)',
              border: '1px solid rgba(216, 102, 76, 0.25)',
              borderRadius: 6,
              padding: '8px 10px',
            }}
          >
            {error}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{
              background: 'transparent',
              border: '1px solid var(--cl-border)',
              borderRadius: 8,
              padding: '8px 14px',
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              color: 'var(--cl-text-secondary)',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: canSubmit ? 'var(--cl-green-700)' : 'var(--cl-border)',
              color: 'var(--cl-on-accent)',
              border: 'none',
              borderRadius: 8,
              padding: '8px 14px',
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" aria-hidden />
                Drafting with Haiku…
              </>
            ) : (
              <>
                <Sparkles size={14} aria-hidden />
                Draft petition
              </>
            )}
          </button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  optional,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--cl-text-muted)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
        {optional && (
          <span style={{ fontWeight: 500, marginLeft: 6, opacity: 0.7 }}>
            optional
          </span>
        )}
      </span>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--cl-border)',
          background: disabled ? 'var(--cl-surface)' : 'var(--cl-card)',
          color: 'var(--cl-text-primary)',
          outline: 'none',
        }}
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--cl-text-muted)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          padding: '8px 10px',
          borderRadius: 6,
          border: '1px solid var(--cl-border)',
          background: 'var(--cl-surface)',
          color: 'var(--cl-text-secondary)',
        }}
      >
        {value}
      </div>
    </div>
  );
}
