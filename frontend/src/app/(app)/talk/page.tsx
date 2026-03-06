import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { TalkContent } from './TalkContent';

export const metadata = { title: 'Talk — OLAF' };

export default function TalkPage() {
  return (
    <>
      <Header title="OLAF" />
      <PageShell id="talk-content">
        <TalkContent />
      </PageShell>
    </>
  );
}
