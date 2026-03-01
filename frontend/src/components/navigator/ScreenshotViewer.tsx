'use client';

interface ScreenshotViewerProps {
  /** Base64-encoded JPEG screenshot */
  screenshotBase64: string;
  /** Page URL being displayed */
  pageUrl?: string;
  /** Page title for alt text */
  pageTitle?: string;
  /** Agent narration — what CARIA is currently doing */
  narration?: string;
  /** Navigation progress 0–100 */
  progress?: number;
  /** Current step / total steps for aria */
  currentStep?: number;
  totalSteps?: number;
}

export function ScreenshotViewer({
  screenshotBase64,
  pageUrl,
  pageTitle,
  narration,
  progress = 0,
  currentStep = 0,
  totalSteps = 0,
}: ScreenshotViewerProps) {
  const altText = pageTitle
    ? `Current webpage screenshot showing ${pageTitle}`
    : 'Current webpage screenshot';

  return (
    <div className="relative bg-bg-surface rounded-2xl overflow-hidden shadow-lg border border-border-default">
      {/* Screenshot image */}
      {screenshotBase64 ? (
        <img
          src={`data:image/jpeg;base64,${screenshotBase64}`}
          alt={altText}
          className="w-full aspect-video object-contain bg-black/5"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-video bg-black/5 flex items-center justify-center">
          <p className="text-body-sm text-text-muted">Waiting for screenshot…</p>
        </div>
      )}

      {/* Action overlay at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-8">
        {/* Progress bar */}
        {totalSteps > 0 && (
          <div className="w-full h-2 bg-bg-muted rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-500"
              role="progressbar"
              aria-valuenow={currentStep}
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-label={`Navigation progress: step ${currentStep} of ${totalSteps}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}

        {/* Narration / status text */}
        {narration && (
          <p className="text-body-sm text-white font-medium" aria-live="polite">
            {narration}
          </p>
        )}

        {/* Page URL hint */}
        {pageUrl && (
          <p className="text-caption text-white/60 mt-1 truncate">{pageUrl}</p>
        )}
      </div>
    </div>
  );
}
