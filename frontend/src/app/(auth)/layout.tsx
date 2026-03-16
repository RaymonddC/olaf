import { type ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="h-dvh flex flex-col relative z-[1]">
            <div className="flex-1 overflow-y-auto">
                <div className="min-h-full flex flex-col items-center justify-center px-4 py-6">
                    {children}
                </div>
            </div>
        </div>
    );
}
