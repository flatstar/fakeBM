/**
 * app/(mini)/post/[id]/_components/PhotoUploadSlot.tsx — one dual-photo slot
 * (PROOF-02). Client component.
 *
 * Replaces the design prototype's `<image-slot>` web component (D-11): the user
 * taps the slot, picks an image, and it is downscaled (lib/downscale → WebP,
 * EXIF-upright) then uploaded DIRECTLY to Vercel Blob via @vercel/blob/client
 * `upload()`. The browser never holds BLOB_READ_WRITE_TOKEN — `upload()` calls
 * the /api/blob/upload token broker (03-03) which gates on the session.
 *
 * Pitfall 2: the uploaded URL is NOT persisted by the upload callback (localhost
 * never receives it). On success we lift `result.url` to the parent PostClient
 * via onUploaded; the URL is persisted later by POST /api/posts.
 *
 * Browser-only deps (createImageBitmap/canvas inside downscale + the Blob client)
 * — this is a leaf CC, never rendered on the server.
 */
'use client';

import { useRef, useState, type ReactElement } from 'react';
import { upload } from '@vercel/blob/client';
import { downscale } from '@/lib/downscale';

export interface PhotoUploadSlotProps {
  /** Slot label, e.g. "시킨 척한 음식". */
  label: string;
  /** Sub hint emoji line, e.g. "🤤 먹고 싶었던 것". */
  hint: string;
  /** The current uploaded URL (lifted state), or null when empty. */
  url: string | null;
  /** Called with the public Blob URL once an upload completes. */
  onUploaded: (url: string) => void;
}

type Status = 'idle' | 'uploading' | 'error';

export function PhotoUploadSlot({
  label,
  hint,
  url,
  onUploaded,
}: PhotoUploadSlotProps): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>('idle');

  const onPick = async (file: File): Promise<void> => {
    setStatus('uploading');
    try {
      // D-12: clamp long edge to 1440px + re-encode WebP@0.8 (EXIF-upright).
      const scaled = await downscale(file, 1440, 0.8);
      const result = await upload(
        `proof/${crypto.randomUUID()}.webp`,
        scaled,
        {
          access: 'public',
          handleUploadUrl: '/api/blob/upload',
          contentType: 'image/webp',
        },
      );
      onUploaded(result.url);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div>
      <div
        style={{
          font: '700 12px var(--font-body)',
          color: 'var(--color-ink2)',
          marginBottom: 6,
          textAlign: 'center',
        }}
      >
        {label}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`${label} 사진 ${url ? '변경' : '추가'}`}
        style={{
          width: '100%',
          height: 130,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 0,
          border: url ? 'none' : '1.5px dashed var(--color-line)',
          borderRadius: 16,
          overflow: 'hidden',
          cursor: 'pointer',
          background: url ? 'var(--color-line)' : 'var(--color-surface)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob URL preview, no next/image opt needed
          <img
            src={url}
            alt={label}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : status === 'uploading' ? (
          <span style={{ font: '600 12px var(--font-body)', color: 'var(--color-ink3)' }}>
            올리는 중…
          </span>
        ) : (
          <>
            <span style={{ fontSize: 28 }}>📷</span>
            <span style={{ font: '500 11.5px var(--font-body)', color: 'var(--color-ink3)' }}>
              {hint}
            </span>
            {status === 'error' && (
              <span style={{ font: '600 11px var(--font-body)', color: 'var(--color-primary)' }}>
                실패 · 다시 시도
              </span>
            )}
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onPick(file);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </div>
  );
}
