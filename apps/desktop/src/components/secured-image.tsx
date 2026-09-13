import { ImageOff, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiBlob } from '../lib/api';
import type { MedicalRecordAttachment } from '../lib/types';

export function SecuredImage({
  recordId,
  attachment,
  className = '',
  onOpen,
}: {
  recordId: string;
  attachment: MedicalRecordAttachment;
  className?: string;
  onOpen?: (url: string, name: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    apiBlob(`/medical-records/${recordId}/attachments/${attachment.id}`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, recordId]);

  if (failed) {
    return (
      <div className={`grid place-items-center bg-slate-100 text-slate-400 ${className}`}>
        <ImageOff className="size-5" />
      </div>
    );
  }
  if (!url) {
    return (
      <div className={`grid place-items-center bg-slate-100 text-slate-400 ${className}`}>
        <LoaderCircle className="size-5 animate-spin" />
      </div>
    );
  }

  return onOpen ? (
    <button
      aria-label={`Xem ảnh ${attachment.originalName}`}
      className={`overflow-hidden ${className}`}
      onClick={() => onOpen(url, attachment.originalName)}
      type="button"
    >
      <img alt={attachment.originalName} className="size-full object-cover" src={url} />
    </button>
  ) : (
    <img alt={attachment.originalName} className={`object-cover ${className}`} src={url} />
  );
}
