'use client';

import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export function Dialog(props: ComponentProps<typeof BaseDialog.Root>) {
  return <BaseDialog.Root {...props} />;
}

export function DialogTrigger(props: ComponentProps<typeof BaseDialog.Trigger>) {
  return <BaseDialog.Trigger {...props} />;
}

interface DialogContentProps {
  children: ReactNode;
  /** Set to false to hide the default close (X) button. */
  showCloseButton?: boolean;
  className?: string;
  /** Inline width override for the popup card. */
  width?: number | string;
}

export function DialogContent({
  children,
  showCloseButton = true,
  width = 440,
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(28, 25, 23, 0.55)',
          zIndex: 300,
          backdropFilter: 'blur(2px)',
        }}
      />
      <BaseDialog.Popup
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100vh - 64px)',
          overflowY: 'auto',
          zIndex: 301,
          background: 'var(--cl-card)',
          border: '1px solid var(--cl-border)',
          borderRadius: 14,
          boxShadow: '0 18px 48px rgba(28, 25, 23, 0.22)',
          padding: '20px 22px',
          fontFamily: 'var(--font-body)',
          color: 'var(--cl-text-primary)',
        }}
      >
        {children}
        {showCloseButton && (
          <BaseDialog.Close
            aria-label="Close"
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'transparent',
              border: 'none',
              color: 'var(--cl-text-muted)',
              padding: 6,
              borderRadius: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} aria-hidden />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div style={{ marginBottom: 14, paddingRight: 24 }}>{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return (
    <BaseDialog.Title
      style={{
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--cl-text-primary)',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </BaseDialog.Title>
  );
}

export function DialogDescription({ children }: { children: ReactNode }) {
  return (
    <BaseDialog.Description
      style={{
        margin: '6px 0 0',
        fontSize: 13,
        color: 'var(--cl-text-muted)',
        lineHeight: 1.45,
      }}
    >
      {children}
    </BaseDialog.Description>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 18,
        paddingTop: 14,
        borderTop: '1px solid var(--cl-border)',
      }}
    >
      {children}
    </div>
  );
}

export function DialogClose(props: ComponentProps<typeof BaseDialog.Close>) {
  return <BaseDialog.Close {...props} />;
}
