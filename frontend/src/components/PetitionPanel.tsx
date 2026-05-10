'use client';

import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback } from 'react';
import { usePetitionStore } from '@/components/PetitionStore';
import type { PetitionDoc } from '@/lib/petition';

const PetitionDownloadButton = dynamic(
  () => import('@/components/PetitionDownloadButton'),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          fontSize: 12,
          color: 'var(--cl-text-muted)',
          fontStyle: 'italic',
        }}
      >
        Loading PDF tools…
      </div>
    ),
  },
);

interface Props {
  doc: PetitionDoc;
  onClose: () => void;
}

export function PetitionPanel({ doc, onClose }: Props) {
  const { updateDraft } = usePetitionStore();

  const updateDisplay = useCallback(
    (field: keyof PetitionDoc['display'], value: string) => {
      updateDraft(doc.id, {
        display: { ...doc.display, [field]: value },
      });
    },
    [doc.id, doc.display, updateDraft],
  );

  const updateBody = useCallback(
    (value: string) => {
      updateDraft(doc.id, { body: value });
    },
    [doc.id, updateDraft],
  );

  const updateSubject = useCallback(
    (value: string) => {
      updateDraft(doc.id, { subject: value });
    },
    [doc.id, updateDraft],
  );

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={onClose}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--cl-text-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          letterSpacing: '0.05em',
          padding: 0,
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={12} aria-hidden />
        BACK TO OVERVIEW
      </button>

      <div
        style={{
          background: 'var(--cl-card)',
          border: '1px solid var(--cl-border)',
          borderRadius: 10,
          padding: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--cl-text-muted)',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}
        >
          CLAUDE HAIKU · DRAFT PETITION
        </div>
        <input
          type="text"
          value={doc.subject}
          onChange={(e) => updateSubject(e.target.value)}
          placeholder="Petition subject"
          style={{
            width: '100%',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--cl-text-primary)',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            background: 'transparent',
            border: 'none',
            padding: 0,
            outline: 'none',
          }}
        />
      </div>

      <EditableMetaRow
        label="To"
        value={doc.display.to}
        onChange={(v) => updateDisplay('to', v)}
      />
      <EditableMetaRow
        label="From"
        value={doc.display.from}
        onChange={(v) => updateDisplay('from', v)}
      />
      <EditableMetaRow
        label="Block"
        value={doc.display.blockLabel}
        onChange={(v) => updateDisplay('blockLabel', v)}
      />
      <EditableMetaRow
        label="Date"
        value={doc.display.dateLabel}
        onChange={(v) => updateDisplay('dateLabel', v)}
      />

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--cl-text-muted)',
            letterSpacing: '0.05em',
          }}
        >
          BODY · EDITABLE
        </span>
        <textarea
          value={doc.body}
          onChange={(e) => updateBody(e.target.value)}
          rows={18}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            lineHeight: 1.55,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid var(--cl-border)',
            background: 'var(--cl-card)',
            color: 'var(--cl-text-primary)',
            outline: 'none',
            resize: 'vertical',
            minHeight: 240,
          }}
        />
      </label>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <PetitionDownloadButton doc={doc} body={doc.body} />
      </div>
    </div>
  );
}

function EditableMetaRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        fontSize: 11,
        background: 'var(--cl-surface)',
        border: '1px solid var(--cl-border)',
        borderRadius: 6,
        padding: '6px 10px',
      }}
    >
      <span
        style={{
          fontWeight: 700,
          color: 'var(--cl-text-muted)',
          letterSpacing: '0.05em',
          minWidth: 44,
        }}
      >
        {label.toUpperCase()}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          fontFamily: 'var(--font-body)',
          fontSize: 11,
          color: 'var(--cl-text-primary)',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          padding: 0,
        }}
      />
    </div>
  );
}
