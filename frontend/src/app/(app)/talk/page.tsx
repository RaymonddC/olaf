import { Header } from '@/components/layout/Header';
import { TalkContent } from './TalkContent';

export const metadata = { title: 'Talk | OLAF' };

export default function TalkPage() {
    return (
        <div className="flex flex-col h-dvh">
            <Header title="OLAF" />
            <div className="flex-1 min-h-0">
                <TalkContent />
            </div>
        </div>
    );
}
