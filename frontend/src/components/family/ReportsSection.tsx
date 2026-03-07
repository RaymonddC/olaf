'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { ReportCard } from './ReportCard';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface Report { id: string; type: string; title: string; createdAt: string; summary?: string; }
interface Props { reports: Report[]; loading: boolean; }

export function ReportsSection({ reports, loading }: Props) {
    if (loading) return <div className="glass rounded-[22px] p-6"><LoadingSkeleton shape="text" lines={3} /></div>;
    if (reports.length === 0) return null;

    return (
        <div className="glass rounded-[22px] p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eff6ff, #fffbeb)' }}>
                        <FileText className="w-4 h-4 text-primary-600" />
                    </div>
                    <h2 className="text-[18px] font-heading font-extrabold text-text-heading">Reports</h2>
                </div>
                <Link href="/dashboard/reports" className="text-body-sm font-heading font-semibold text-primary-600 hover:text-primary-700">View all</Link>
            </div>
            <div className="space-y-3">
                {reports.slice(0, 3).map(r => <ReportCard key={r.id} {...r} />)}
            </div>
        </div>
    );
}