'use client';

import type { ModalLayerProps } from './ModalLayer';
import { ModalLayer } from './ModalLayer';

export type DrawerProps = Omit<ModalLayerProps, 'presentation'>;

/** A short secondary workflow. It becomes a bottom sheet on narrow screens. */
export function Drawer({ drawerPlacement = 'end', ...props }: DrawerProps) {
  return <ModalLayer {...props} presentation="drawer" drawerPlacement={drawerPlacement} />;
}
