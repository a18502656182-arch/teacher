'use client';
import type { ArtworkRole } from './contracts';
import { useWorkbenchTheme } from './ThemeBoundary';

/** Missing future-theme artwork does not substitute a campus illustration. */
export function Artwork({ role }: { role: ArtworkRole }) {
  const asset = useWorkbenchTheme().artworkByRole[role];
  if (!asset) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={asset.src} width={asset.width} height={asset.height} alt="" aria-hidden="true" style={{ objectFit: asset.fit, objectPosition: `${asset.focalPoint[0]}% ${asset.focalPoint[1]}%` }} />;
}
