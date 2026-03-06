import { Header } from '@/components/layout/Header';
import { TalkContent } from './TalkContent';

export const metadata = { title: 'Talk — OLAF' };

export default function TalkPage() {
  return (
    <div className="flex flex-col h-dvh">
      <Header title="OLAF" />
      {/* Fill remaining height between header and bottom nav, no scroll */}
      <div className="flex-1 flex items-center justify-center px-4 pb-20 overflow-hidden">
        <TalkContent />
      </div>
    </div>
  );
}
