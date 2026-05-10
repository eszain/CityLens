'use client';

import { PDFDownloadLink } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import { PetitionPDFDocument } from '@/components/PetitionPDFDocument';
import { petitionFilename, type PetitionDoc } from '@/lib/petition';

interface Props {
  doc: PetitionDoc;
  body: string;
}

export default function PetitionDownloadButton({ doc, body }: Props) {
  return (
    <PDFDownloadLink
      document={<PetitionPDFDocument doc={doc} body={body} />}
      fileName={petitionFilename(doc)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'var(--cl-green-700)',
        color: 'var(--cl-on-accent)',
        textDecoration: 'none',
        border: 'none',
        borderRadius: 8,
        padding: '8px 14px',
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.02em',
        cursor: 'pointer',
      }}
    >
      {({ loading }) =>
        loading ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden />
            Building PDF…
          </>
        ) : (
          <>
            <Download size={14} aria-hidden />
            Download PDF
          </>
        )
      }
    </PDFDownloadLink>
  );
}
