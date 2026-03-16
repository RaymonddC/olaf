'use client';

/**
 * OLAF logo — four-petal clover shape in mint/teal.
 * Accepts className and size props for flexible use.
 */
export function OlafLogo({ size = 28, className = '' }: { size?: number; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            aria-label="OLAF logo"
        >
            {/* Four-petal clover */}
            <path
                d="M50 8C50 8 62 20 62 32C62 38 58 44 50 48C42 44 38 38 38 32C38 20 50 8 50 8Z"
                fill="currentColor"
                opacity="0.25"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M92 50C92 50 80 62 68 62C62 62 56 58 52 50C56 42 62 38 68 38C80 38 92 50 92 50Z"
                fill="currentColor"
                opacity="0.25"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M50 92C50 92 38 80 38 68C38 62 42 56 50 52C58 56 62 62 62 68C62 80 50 92 50 92Z"
                fill="currentColor"
                opacity="0.25"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M8 50C8 50 20 38 32 38C38 38 44 42 48 50C44 58 38 62 32 62C20 62 8 50 8 50Z"
                fill="currentColor"
                opacity="0.25"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}
