'use client';
import type { ArtworkRole } from './contracts';
import { useWorkbenchTheme } from './ThemeBoundary';

/** Missing future-theme artwork does not substitute a campus illustration. */
export function Artwork({ role, className = '', sizes }: { role: ArtworkRole; className?: string; sizes?: string }) {
  const asset = useWorkbenchTheme().artworkByRole[role];
  if (!asset) return null;
  // Theme assets use reviewed intrinsic dimensions and optional mobile sources.
  // eslint-disable-next-line @next/next/no-img-element
  const image = <img
    className={className}
    src={asset.src}
    width={asset.width}
    height={asset.height}
    sizes={sizes}
    alt=""
    aria-hidden="true"
    decoding="async"
    data-artwork-role={role}
    data-safe-text-area={asset.safeTextArea}
    data-artwork-status={asset.status}
    style={{ objectFit: asset.fit, objectPosition: `${asset.focalPoint[0]}% ${asset.focalPoint[1]}%` }}
  />;
  if (!asset.mobileSrc) return image;
  return <picture><source media="(max-width: 600px)" srcSet={asset.mobileSrc}/>{image}</picture>;
}
