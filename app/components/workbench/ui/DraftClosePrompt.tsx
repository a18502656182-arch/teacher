'use client';

import { Button } from './Button';
import { Dialog } from './Dialog';

export function DraftClosePrompt({
  open,
  title = '尚有未完成的选择',
  description = '放弃后，本次尚未确认的内容不会保留。',
  discardLabel = '放弃修改',
  onContinue,
  onDiscard,
}: {
  open: boolean;
  title?: string;
  description?: string;
  discardLabel?: string;
  onContinue: () => void;
  onDiscard: () => void;
}) {
  return <Dialog
    open={open}
    title={title}
    onRequestClose={onContinue}
    footer={<>
      <Button intent="secondary" autoFocus onClick={onContinue}>继续编辑</Button>
      <Button intent="danger" onClick={onDiscard}>{discardLabel}</Button>
    </>}
  >
    <p>{description}</p>
  </Dialog>;
}
