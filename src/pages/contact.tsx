import type { ReactNode } from 'react';
import React from 'react';
import Layout from '@theme/Layout';
import ContactForm from '@site/src/components/ContactForm';

// ─── Replace this with your real Apps Script web-app URL ──────────────────────
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw1ehpFwjyeGrSMW_8UJD44Vh1Ab12RsE7eTIRXKnLJMT2xRhU_Bqm0HUgXxz05O_Z-JA/exec';

export default function ContactPage(): ReactNode {
  return (
    <Layout
      title="Contact"
      description="Send Happy-Ferret Entertainment a message"
    >
      <main style={{ padding: '2rem 0 4rem' }}>
        <ContactForm scriptUrl={SCRIPT_URL} heading="Get In Touch" />
      </main>
    </Layout>
  );
}