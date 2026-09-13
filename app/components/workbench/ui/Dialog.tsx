'use client';

import type { ModalLayerProps } from './ModalLayer';
import { ModalLayer } from './ModalLayer';

export type { CloseReason } from './ModalLayer';

export type DialogProps = Omit<ModalLayerProps, 'presentation' | 'drawerPlacement'>;

/** A bounded decision or editing surface. Dirty-close policy belongs to its controller. */
export function Dialog(props: DialogProps) {
  return <ModalLayer {...props} presentation="dialog" />;
}
