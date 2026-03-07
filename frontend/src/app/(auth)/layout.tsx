import { type ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 relative z-[1]">
            {children}
        </div>
    );
}