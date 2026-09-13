'use client';

import { useId, type ReactNode } from 'react';
import type { ArtworkRole } from '../theme/contracts';
import { Artwork } from '../theme/Artwork';
import styles from './controls.module.css';

export function LoadingState({ title = '正在加载', detail }: { title?: string; detail?: string }) {
  return <div className={styles.loadingState} role="status" aria-live="polite">
    <span className={styles.spinner} aria-hidden="true"/>
    <span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
  </div>;
}

export function EmptyState({ title, description, action, artworkRole = 'empty.first-use' }: {
  title: string;
  description: string;
  action?: ReactNode;
  artworkRole?: Extract<ArtworkRole, 'empty.first-use' | 'empty.no-results'>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  return <section className={styles.emptyState} aria-labelledby={titleId} aria-describedby={descriptionId}>
    <Artwork role={artworkRole} className={styles.emptyArtwork}/>
    <div><h3 id={titleId}>{title}</h3><p id={descriptionId}>{description}</p>{action && <div className={styles.emptyAction}>{action}</div>}</div>
  </section>;
}
