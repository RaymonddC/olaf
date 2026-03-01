'use client';

import { useRef, useCallback, useEffect, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

interface CameraToggleProps {
  /** Whether the voice session is currently active */
  sessionActive: boolean;
  /** Called with base64 JPEG data ~1 FPS while camera is on */
  onFrame: (jpegBase64: string) => void;
  disabled?: boolean;
}

/**
 * Camera toggle button for medication bottle scanning.
 *
 * When enabled, captures video frames from the user's camera at ~1 FPS
 * and sends them to the Gemini Live API for visual analysis.
 * Camera is only available during an active voice session.
 */
export function CameraToggle({
  sessionActive,
  onFrame,
  disabled = false,
}: CameraToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setEnabled(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 768, height: 768 },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Capture frames at ~1 FPS
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = 768;
        canvasRef.current.height = 768;
        ctx.drawImage(videoRef.current, 0, 0, 768, 768);

        canvasRef.current.toBlob(
          (blob) => {
            if (!blob) return;
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              if (base64) onFrame(base64);
            };
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.9,
        );
      }, 1000);

      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  }, [onFrame]);

  const toggle = useCallback(() => {
    if (enabled) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [enabled, startCamera, stopCamera]);

  // Stop camera when session ends
  useEffect(() => {
    if (!sessionActive && enabled) {
      stopCamera();
    }
  }, [sessionActive, enabled, stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const isDisabled = disabled || !sessionActive;

  return (
    <>
      {/* Hidden video element for camera capture */}
      <video
        ref={videoRef}
        className="sr-only"
        muted
        playsInline
        aria-hidden="true"
      />
      <canvas ref={canvasRef} className="sr-only" aria-hidden="true" />

      <button
        type="button"
        onClick={toggle}
        disabled={isDisabled}
        aria-label={enabled ? 'Turn off camera' : 'Turn on camera'}
        aria-pressed={enabled}
        className={[
          'inline-flex items-center justify-center gap-2',
          'min-h-[48px] px-5 py-3',
          'font-semibold rounded-xl text-body',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
          enabled
            ? 'bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900'
            : 'bg-white text-primary-700 border-2 border-primary-300 shadow-sm hover:bg-primary-50 hover:border-primary-400 active:bg-primary-100',
          isDisabled
            ? 'disabled:bg-bg-muted disabled:text-text-muted disabled:border-border-default disabled:cursor-not-allowed disabled:shadow-none'
            : 'cursor-pointer',
        ].join(' ')}
      >
        {enabled ? (
          <CameraOff className="w-5 h-5" aria-hidden="true" />
        ) : (
          <Camera className="w-5 h-5" aria-hidden="true" />
        )}
        <span>Camera</span>
      </button>
    </>
  );
}
