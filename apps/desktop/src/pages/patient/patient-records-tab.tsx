import {
  Clock3,
  FileHeart,
  Images,
  Pencil,
  Plus,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { SecuredImage } from '../../components/secured-image';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  Pagination,
  SearchInput,
  Textarea,
} from '../../components/ui';
import { useAuth } from '../../contexts/use-auth';
import { useToast } from '../../contexts/use-toast';
import { api, errorMessage, toQuery } from '../../lib/api';
import { formatDateTime, toDateTimeInput } from '../../lib/format';
import type { MedicalRecord, MedicalRecordAttachment, PageResult } from '../../lib/types';

interface RecordForm {
  recordedAt: string;
  title: string;
  chiefComplaint: string;
  bloodPressure: string;
  pulse: string;
  temperature: string;
  weight: string;
}

interface PendingImage {
  file: File;
  url: string;
}

const blankForm = (): RecordForm => ({
  recordedAt: toDateTimeInput(new Date().toISOString()),
  title: '',
  chiefComplaint: '',
  bloodPressure: '',
  pulse: '',
  temperature: '',
  weight: '',
});

export function PatientRecordsTab({ patientId }: { patientId: string }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<PageResult<MedicalRecord> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalRecord | null>(null);
  const [deleting, setDeleting] = useState<MedicalRecord | null>(null);
  const [form, setForm] = useState<RecordForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<MedicalRecordAttachment | null>(
    null,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api<PageResult<MedicalRecord>>(
          `/patients/${patientId}/medical-records${toQuery({ page, limit: 10, search: debouncedSearch })}`,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, patientId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    clearPendingImages();
    setEditing(null);
    setForm(blankForm());
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (record: MedicalRecord) => {
    clearPendingImages();
    const vitals = record.vitalSigns ?? {};
    setEditing(record);
    setForm({
      recordedAt: toDateTimeInput(record.recordedAt),
      title: record.title ?? '',
      chiefComplaint: record.chiefComplaint ?? '',
      bloodPressure: String(vitals.bloodPressure ?? ''),
      pulse: String(vitals.pulse ?? ''),
      temperature: String(vitals.temperature ?? ''),
      weight: String(vitals.weight ?? ''),
    });
    setFormError('');
    setFormOpen(true);
  };

  const clearPendingImages = () => {
    setPendingImages((images) => {
      images.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
  };

  const closeForm = () => {
    clearPendingImages();
    setFormOpen(false);
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    const incoming = Array.from(files);
    const invalid = incoming.find(
      (file) =>
        (!acceptedTypes.has(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) ||
        file.size <= 0 ||
        file.size > 10_485_760,
    );
    if (invalid) {
      setFormError('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP, tối đa 10 MB mỗi ảnh.');
      return;
    }
    const existingCount = editing?.attachments.length ?? 0;
    if (existingCount + pendingImages.length + incoming.length > 20) {
      setFormError('Mỗi hồ sơ y tế được đính kèm tối đa 20 ảnh.');
      return;
    }
    setFormError('');
    setPendingImages((images) => [
      ...images,
      ...incoming.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removePendingImage = (index: number) => {
    setPendingImages((images) => {
      URL.revokeObjectURL(images[index]!.url);
      return images.filter((_, currentIndex) => currentIndex !== index);
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((editing?.attachments.length ?? 0) + pendingImages.length === 0) {
      setFormError('Vui lòng chọn ít nhất một ảnh cho hồ sơ bệnh nhân.');
      return;
    }
    setSaving(true);
    setFormError('');
    const vitalSigns = Object.fromEntries(
      Object.entries({
        bloodPressure: form.bloodPressure.trim(),
        pulse: form.pulse.trim(),
        temperature: form.temperature.trim(),
        weight: form.weight.trim(),
      }).filter(([, value]) => value),
    );
    const payload = {
      recordedAt: new Date(form.recordedAt).toISOString(),
      title: form.title || null,
      chiefComplaint: form.chiefComplaint || null,
      vitalSigns: Object.keys(vitalSigns).length ? vitalSigns : null,
    };
    try {
      let savedRecord: MedicalRecord;
      if (editing) {
        savedRecord = await api<MedicalRecord>(`/medical-records/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        savedRecord = await api<MedicalRecord>(`/patients/${patientId}/medical-records`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      let imageUploadFailed = false;
      if (pendingImages.length) {
        try {
          for (let index = 0; index < pendingImages.length; index += 10) {
            const upload = new FormData();
            pendingImages
              .slice(index, index + 10)
              .forEach(({ file }) => upload.append('files', file));
            await api(`/medical-records/${savedRecord.id}/attachments`, {
              method: 'POST',
              body: upload,
            });
          }
        } catch (caught) {
          imageUploadFailed = true;
          showToast(`Đã lưu nội dung nhưng chưa tải được ảnh: ${errorMessage(caught)}`, 'error');
        }
      }

      if (!imageUploadFailed) {
        showToast(editing ? 'Đã cập nhật hồ sơ y tế.' : 'Đã tạo hồ sơ y tế.');
      }
      closeForm();
      await load();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const removeAttachment = async () => {
    if (!editing || !attachmentToDelete) return;
    setSaving(true);
    try {
      await api(`/medical-records/${editing.id}/attachments/${attachmentToDelete.id}`, {
        method: 'DELETE',
      });
      const nextAttachments = editing.attachments.filter(
        (attachment) => attachment.id !== attachmentToDelete.id,
      );
      setEditing({ ...editing, attachments: nextAttachments });
      setAttachmentToDelete(null);
      showToast('Đã xóa ảnh khỏi hồ sơ.');
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await api(`/medical-records/${deleting.id}`, { method: 'DELETE' });
      showToast('Đã xóa hồ sơ y tế.');
      setDeleting(null);
      await load();
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <SearchInput
          onChange={setSearch}
          placeholder="Tìm tiêu đề hoặc triệu chứng…"
          value={search}
        />
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Thêm hồ sơ y tế
        </Button>
      </header>
      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : loading ? (
        <LoadingState rows={5} />
      ) : !result?.items.length ? (
        <EmptyState
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Tạo hồ sơ đầu tiên
            </Button>
          }
          description="Ghi nhận lần thăm khám, triệu chứng và chỉ số sinh tồn."
          title="Chưa có hồ sơ y tế"
        />
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {result.items.map((record) => (
              <article className="group px-5 py-5 hover:bg-slate-50/70" key={record.id}>
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
                    <FileHeart className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-800">
                          {record.title || 'Hồ sơ khám bệnh'}
                        </h3>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3.5" />
                            {formatDateTime(record.recordedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <UserRound className="size-3.5" />
                            {record.recordedByUser?.fullName ?? 'Nhân viên'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          aria-label="Chỉnh sửa"
                          className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-emerald-700"
                          onClick={() => openEdit(record)}
                          type="button"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {user?.role === 'ADMIN' && (
                          <button
                            aria-label="Xóa"
                            className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => setDeleting(record)}
                            type="button"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    {record.chiefComplaint && (
                      <p className="mt-3 text-sm">
                        <span className="font-semibold text-slate-600">Triệu chứng chính:</span>{' '}
                        <span className="text-slate-600">{record.chiefComplaint}</span>
                      </p>
                    )}
                    {record.attachments.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {record.attachments.slice(0, 4).map((attachment) => (
                            <SecuredImage
                              attachment={attachment}
                              className="size-10 rounded-lg border-2 border-white bg-slate-100"
                              key={attachment.id}
                              onOpen={(url, name) => setPreview({ url, name })}
                              recordId={record.id}
                            />
                          ))}
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                          <Images className="size-3.5" /> {record.attachments.length} ảnh
                        </span>
                      </div>
                    )}
                    {record.vitalSigns && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(record.vitalSigns).map(([key, value]) => (
                          <span
                            className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                            key={key}
                          >
                            {vitalLabel[key] ?? key}: <strong>{String(value)}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <Pagination onChange={setPage} value={result.pagination} />
        </>
      )}

      <Modal
        footer={
          <>
            <Button onClick={closeForm} variant="secondary">
              Hủy
            </Button>
            <Button form="record-form" loading={saving} type="submit">
              {editing ? 'Lưu thay đổi' : 'Tạo hồ sơ'}
            </Button>
          </>
        }
        onClose={closeForm}
        open={formOpen}
        size="lg"
        title={editing ? 'Cập nhật hồ sơ y tế' : 'Hồ sơ y tế mới'}
      >
        <form className="grid gap-4" id="record-form" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Thời điểm ghi nhận"
              max={toDateTimeInput(new Date().toISOString())}
              onChange={(event) => setForm({ ...form, recordedAt: event.target.value })}
              required
              type="datetime-local"
              value={form.recordedAt}
            />
            <Input
              label="Tiêu đề"
              maxLength={200}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Ví dụ: Tái khám định kỳ"
              value={form.title}
            />
          </div>
          <Textarea
            label="Ghi chú"
            maxLength={2000}
            onChange={(event) => setForm({ ...form, chiefComplaint: event.target.value })}
            value={form.chiefComplaint}
          />
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">
              Hồ sơ bệnh nhân <span className="text-rose-500">*</span>
            </legend>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="medical-record-images"
              multiple
              onChange={(event) => {
                addImages(event.target.files);
                event.target.value = '';
              }}
              type="file"
            />
            <label
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
              htmlFor="medical-record-images"
            >
              <span className="grid size-9 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Upload className="size-4" />
              </span>
              <span className="mt-2 text-sm font-semibold text-slate-700">
                Chọn ảnh từ máy tính
              </span>
              <span className="mt-1 text-xs text-slate-400">
                JPEG, PNG hoặc WebP · tối đa 10 MB/ảnh · tối đa 20 ảnh
              </span>
            </label>

            {Boolean(editing?.attachments.length || pendingImages.length) && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {editing?.attachments.map((attachment) => (
                  <div
                    className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                    key={attachment.id}
                  >
                    <SecuredImage
                      attachment={attachment}
                      className="size-full"
                      onOpen={(url, name) => setPreview({ url, name })}
                      recordId={editing.id}
                    />
                    <button
                      aria-label={`Xóa ảnh ${attachment.originalName}`}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-slate-500 opacity-0 shadow-sm transition hover:text-rose-700 group-hover:opacity-100"
                      onClick={() => setAttachmentToDelete(attachment)}
                      type="button"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <p className="absolute inset-x-0 bottom-0 truncate bg-slate-950/60 px-2 py-1.5 text-[10px] text-white">
                      {attachment.originalName}
                    </p>
                  </div>
                ))}
                {pendingImages.map((image, index) => (
                  <div
                    className="group relative aspect-square overflow-hidden rounded-xl border border-emerald-200 bg-slate-100"
                    key={`${image.file.name}-${image.file.lastModified}`}
                  >
                    <button
                      aria-label={`Xem ảnh ${image.file.name}`}
                      className="size-full"
                      onClick={() => setPreview({ url: image.url, name: image.file.name })}
                      type="button"
                    >
                      <img
                        alt={image.file.name}
                        className="size-full object-cover"
                        src={image.url}
                      />
                    </button>
                    <button
                      aria-label={`Bỏ ảnh ${image.file.name}`}
                      className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1.5 text-slate-500 shadow-sm hover:text-rose-700"
                      onClick={() => removePendingImage(index)}
                      type="button"
                    >
                      <X className="size-3.5" />
                    </button>
                    <p className="absolute inset-x-0 bottom-0 truncate bg-emerald-950/65 px-2 py-1.5 text-[10px] text-white">
                      {image.file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </fieldset>
          <fieldset className="rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-700">Chỉ số sinh tồn</legend>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Huyết áp"
                onChange={(event) => setForm({ ...form, bloodPressure: event.target.value })}
                placeholder="120/80 mmHg"
                value={form.bloodPressure}
              />
              <Input
                label="Mạch"
                onChange={(event) => setForm({ ...form, pulse: event.target.value })}
                placeholder="72 bpm"
                value={form.pulse}
              />
              <Input
                label="Nhiệt độ"
                onChange={(event) => setForm({ ...form, temperature: event.target.value })}
                placeholder="36.8 °C"
                value={form.temperature}
              />
              <Input
                label="Cân nặng"
                onChange={(event) => setForm({ ...form, weight: event.target.value })}
                placeholder="60 kg"
                value={form.weight}
              />
            </div>
          </fieldset>
          {formError && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</p>
          )}
        </form>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setDeleting(null)} variant="secondary">
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void remove()} variant="danger">
              Xóa hồ sơ
            </Button>
          </>
        }
        onClose={() => setDeleting(null)}
        open={Boolean(deleting)}
        size="sm"
        title="Xóa hồ sơ y tế"
      >
        <p className="text-sm leading-6 text-slate-600">
          Hồ sơ “{deleting?.title || 'Hồ sơ khám bệnh'}” sẽ được xóa mềm. Không thể xóa nếu còn dữ
          liệu y tế liên quan.
        </p>
      </Modal>

      <Modal
        onClose={() => setPreview(null)}
        open={Boolean(preview)}
        size="lg"
        title={preview?.name ?? 'Ảnh hồ sơ'}
      >
        {preview && (
          <img
            alt={preview.name}
            className="mx-auto max-h-[70vh] max-w-full rounded-xl object-contain"
            src={preview.url}
          />
        )}
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setAttachmentToDelete(null)} variant="secondary">
              Hủy
            </Button>
            <Button loading={saving} onClick={() => void removeAttachment()} variant="danger">
              Xóa ảnh
            </Button>
          </>
        }
        onClose={() => setAttachmentToDelete(null)}
        open={Boolean(attachmentToDelete)}
        size="sm"
        title="Xóa ảnh hồ sơ"
      >
        <p className="text-sm leading-6 text-slate-600">
          Ảnh “{attachmentToDelete?.originalName}” sẽ bị xóa vĩnh viễn khỏi hồ sơ này.
        </p>
      </Modal>
    </section>
  );
}

const vitalLabel: Record<string, string> = {
  bloodPressure: 'Huyết áp',
  pulse: 'Mạch',
  temperature: 'Nhiệt độ',
  weight: 'Cân nặng',
};
