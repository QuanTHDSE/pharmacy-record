import { Button, Modal } from './ui';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  danger = false,
  loading = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      footer={
        <>
          <Button onClick={onCancel} variant="secondary">
            Hủy
          </Button>
          <Button loading={loading} onClick={onConfirm} variant={danger ? 'danger' : 'primary'}>
            {confirmLabel}
          </Button>
        </>
      }
      onClose={onCancel}
      open={open}
      size="sm"
      title={title}
    >
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </Modal>
  );
}
