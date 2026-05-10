'use client';

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { PetitionDoc } from '@/lib/petition';

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingLeft: 56,
    paddingRight: 56,
    fontFamily: 'Helvetica',
    color: '#1c1917',
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#6b6258',
    marginBottom: 8,
  },
  subject: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 14,
    lineHeight: 1.25,
  },
  metaBlock: {
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d6d2cc',
    borderBottomStyle: 'solid',
  },
  metaRow: {
    flexDirection: 'row',
    fontSize: 10,
    marginBottom: 3,
    color: '#3a342d',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    width: 80,
  },
  metaValue: {
    flex: 1,
  },
  bodyParagraph: {
    fontSize: 11,
    lineHeight: 1.55,
    marginBottom: 10,
    color: '#1c1917',
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: '#8a8278',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e6e2dc',
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
});

interface Props {
  doc: PetitionDoc;
  body: string;
}

export function PetitionPDFDocument({ doc, body }: Props) {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document
      title={doc.subject || 'CityLens Petition'}
      author={doc.display.from}
      subject={`Petition regarding ${doc.block.name}`}
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>CityLens · Climate-equity petition</Text>
        <Text style={styles.subject}>{doc.subject || 'Petition'}</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>To:</Text>
            <Text style={styles.metaValue}>{doc.display.to}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>From:</Text>
            <Text style={styles.metaValue}>{doc.display.from}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Block:</Text>
            <Text style={styles.metaValue}>{doc.display.blockLabel}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date:</Text>
            <Text style={styles.metaValue}>{doc.display.dateLabel}</Text>
          </View>
        </View>

        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.bodyParagraph}>
            {p}
          </Text>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Generated via CityLens AI · ${doc.display.dateLabel} · Page ${pageNumber} of ${totalPages}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
