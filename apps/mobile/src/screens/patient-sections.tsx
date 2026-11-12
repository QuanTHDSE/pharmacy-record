import { ALLERGY_SEVERITIES, ALLERGY_TYPES, DISEASE_STATUSES } from '@pharmacy-records/shared';
import type { AllergySeverity, AllergyType, DiseaseStatus } from '@pharmacy-records/shared';
// expo-image gửi header Authorization ổn định trên cả Android lẫn iOS (Image gốc của RN thì không).
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, attachmentUrl, errorMessage, getAccessToken, query } from '../api';
import {
  allergyTypeLabels,
  diseaseStatusLabels,
  diseaseStatusTones,
  severityLabels,
  severityTones,
} from '../labels';
import type { Allergy, Attachment, Disease, MedicalRecord, PageResult, PatientDisease } from '../types';
import {
  Badge,
  Busy,
  Button,
  Card,
  Chip,
  colors,
  displayDateToIso,
  EmptyState,
  ErrorState,
  Field,
  formatDate,
  Icon,
  IconButton,
  maskDate,
  Message,
  SearchBar,
  SectionHeader,
  Sheet,
  toneOf,
} from '../ui';

const MAX_IMAGES_PER_UPLOAD = 10; // giới hạn multer của API
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

interface SectionProps {
  patientId: string;
  canDelete: boolean;
  onChanged: () => void;
}

function confirmDelete(title: string, message: string, onConfirm: () => Promise<void>) {
  Alert.alert(title, message, [
    { text: 'Hủy', style: 'cancel' },
    { text: 'Xóa', style: 'destructive', onPress: () => void onConfirm() },
  ]);
}

function useSectionList<T>(path: string) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      setItems((await api<PageResult<T>>(`${path}${query({ page: 1, limit: 50 })}`)).items);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    void load();
  }, [load]);
  return { items, loading, error, load };
}

// ================= Hồ sơ y tế =================

function imageMime(asset: ImagePicker.ImagePickerAsset): string | null {
  const extension = (asset.fileName ?? asset.uri).split('.').pop()?.toLowerCase();
  const inferred = ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as Record<string, string>)[
    extension ?? ''
  ];
  return asset.mimeType ?? inferred ?? null;
}

function attachmentSource(recordId: string, attachmentId: string) {
  return {
    uri: attachmentUrl(recordId, attachmentId),
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
    // Ảnh không đổi sau khi tải lên → cache theo id, không phụ thuộc token.
    cacheKey: `attachment-${attachmentId}`,
  };
}

export function RecordSection({ patientId, canDelete, onChanged }: SectionProps) {
  const { items: records, loading, error, load } = useSectionList<MedicalRecord>(
    `/patients/${patientId}/medical-records`,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [viewer, setViewer] = useState<{ record: MedicalRecord; index: number } | null>(null);

  async function remove(record: MedicalRecord) {
    try {
      await api(`/medical-records/${record.id}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (caught) {
      Alert.alert('Không thể xóa', errorMessage(caught));
    }
  }

  return (
    <View style={sectionStyles.stack}>
      <SectionHeader
        title="Hồ sơ y tế"
        count={records.length || undefined}
        action={<Button label="Thêm" icon="plus" compact onPress={() => setFormOpen(true)} />}
      />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? (
        <Busy />
      ) : records.length ? (
        records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            canDelete={canDelete}
            onOpenImage={(index) => setViewer({ record, index })}
            onDelete={() =>
              confirmDelete('Xóa hồ sơ y tế?', `“${record.title || 'Hồ sơ y tế'}” sẽ bị xóa khỏi bệnh nhân.`, () =>
                remove(record),
              )
            }
          />
        ))
      ) : !error ? (
        <EmptyState
          icon="file-document-outline"
          title="Chưa có hồ sơ y tế"
          text="Chụp đơn thuốc hoặc kết quả khám để lưu vào hồ sơ."
        />
      ) : null}

      <RecordFormSheet
        visible={formOpen}
        patientId={patientId}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await load();
          onChanged();
        }}
      />
      <ImageViewer
        record={viewer?.record ?? null}
        initialIndex={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

function RecordCard({
  record,
  canDelete,
  onOpenImage,
  onDelete,
}: {
  record: MedicalRecord;
  canDelete: boolean;
  onOpenImage: (index: number) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const longNotes = record.clinicalNotes.length > 180;
  return (
    <Card>
      <View style={sectionStyles.cardHead}>
        <View style={sectionStyles.cardHeadText}>
          <Text style={sectionStyles.cardTitle}>{record.title || 'Hồ sơ y tế'}</Text>
          <Text style={sectionStyles.meta}>
            {formatDate(record.recordedAt)} · {record.recordedByUser?.fullName ?? 'Nhân viên'}
          </Text>
        </View>
        {canDelete ? <IconButton icon="trash-can-outline" label="Xóa hồ sơ" tone="danger" onPress={onDelete} /> : null}
      </View>
      {record.chiefComplaint ? (
        <View style={sectionStyles.block}>
          <Text style={sectionStyles.blockLabel}>Lý do khám</Text>
          <Text style={sectionStyles.body}>{record.chiefComplaint}</Text>
        </View>
      ) : null}
      {record.clinicalNotes ? (
        <View style={sectionStyles.block}>
          <Text style={sectionStyles.blockLabel}>Ghi chú lâm sàng</Text>
          <Text style={sectionStyles.body} numberOfLines={expanded ? undefined : 4}>
            {record.clinicalNotes}
          </Text>
          {longNotes ? (
            <Pressable hitSlop={8} onPress={() => setExpanded((value) => !value)}>
              <Text style={sectionStyles.link}>{expanded ? 'Thu gọn' : 'Xem thêm'}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {record.attachments.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={sectionStyles.thumbs}>
          {record.attachments.map((attachment, index) => (
            <Pressable
              key={attachment.id}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Xem ảnh ${attachment.originalName}`}
              onPress={() => onOpenImage(index)}
              style={({ pressed }) => pressed && sectionStyles.pressed}
            >
              <Image
                source={attachmentSource(record.id, attachment.id)}
                style={sectionStyles.thumb}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={150}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </Card>
  );
}

function ImageViewer({
  record,
  initialIndex,
  onClose,
}: {
  record: MedicalRecord | null;
  initialIndex: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => setIndex(initialIndex), [initialIndex, record]);
  const attachments: Attachment[] = record?.attachments ?? [];
  return (
    <Modal visible={!!record} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={sectionStyles.viewer}>
        {record ? (
          <FlatList
            data={attachments}
            horizontal
            pagingEnabled
            initialScrollIndex={initialIndex}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(item) => item.id}
            onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image
                source={attachmentSource(record.id, item.id)}
                style={{ width, height }}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            )}
          />
        ) : null}
        <View style={[sectionStyles.viewerBar, { paddingTop: insets.top + 8 }]}>
          <Text style={sectionStyles.viewerText} numberOfLines={1}>
            {attachments[index]?.originalName ?? ''}  {attachments.length > 1 ? `${index + 1}/${attachments.length}` : ''}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={10} onPress={onClose} style={sectionStyles.viewerClose}>
            <Icon name="close" size={26} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RecordFormSheet({
  visible,
  patientId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  patientId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [complaint, setComplaint] = useState('');
  const [notes, setNotes] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  // Nếu đã tạo hồ sơ nhưng tải ảnh lỗi → lần lưu tiếp chỉ tải lại ảnh, không tạo hồ sơ trùng.
  const [pendingRecordId, setPendingRecordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function reset() {
    setTitle('');
    setComplaint('');
    setNotes('');
    setImages([]);
    setPendingRecordId(null);
    setFormError('');
  }

  function close() {
    if (saving) return;
    reset();
    onClose();
  }

  function addAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const rejected: string[] = [];
    const accepted = assets.filter((asset) => {
      const mime = imageMime(asset);
      if (!mime || !ACCEPTED_MIME.includes(mime)) {
        rejected.push('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
        return false;
      }
      if (asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        rejected.push('Mỗi ảnh phải nhỏ hơn 10 MB.');
        return false;
      }
      return true;
    });
    setImages((current) => {
      const merged = [...current, ...accepted];
      if (merged.length > MAX_IMAGES_PER_UPLOAD) rejected.push(`Tối đa ${MAX_IMAGES_PER_UPLOAD} ảnh mỗi lần lưu.`);
      return merged.slice(0, MAX_IMAGES_PER_UPLOAD);
    });
    setFormError([...new Set(rejected)].join(' '));
  }

  async function takePhoto() {
    setFormError('');
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setFormError('Cần cho phép dùng camera để chụp ảnh.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) addAssets(result.assets);
  }

  async function pickFromLibrary() {
    setFormError('');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setFormError('Cần cho phép truy cập thư viện ảnh để chọn ảnh.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: Math.max(1, MAX_IMAGES_PER_UPLOAD - images.length),
    });
    if (!result.canceled) addAssets(result.assets);
  }

  async function save() {
    if (!images.length) {
      setFormError('Vui lòng chụp hoặc chọn ít nhất một ảnh cho hồ sơ.');
      return;
    }
    setSaving(true);
    setFormError('');
    let recordId = pendingRecordId;
    if (!recordId) {
      try {
        const saved = await api<MedicalRecord>(`/patients/${patientId}/medical-records`, {
          method: 'POST',
          body: JSON.stringify({
            recordedAt: new Date().toISOString(),
            title: title.trim() || null,
            chiefComplaint: complaint.trim() || null,
            clinicalNotes: notes.trim(),
          }),
        });
        recordId = saved.id;
        setPendingRecordId(saved.id);
      } catch (caught) {
        setFormError(errorMessage(caught));
        setSaving(false);
        return;
      }
    }

    try {
      const upload = new FormData();
      images.forEach((image, index) => {
        const mime = imageMime(image) ?? 'image/jpeg';
        const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        upload.append('files', {
          uri: image.uri,
          name: image.fileName || `record-${Date.now()}-${index + 1}.${extension}`,
          type: mime,
        } as unknown as Blob);
      });
      await api(`/medical-records/${recordId}/attachments`, { method: 'POST', body: upload });
      reset();
      setSaving(false);
      await onSaved();
    } catch (caught) {
      setFormError(`Nội dung đã lưu nhưng tải ảnh thất bại: ${errorMessage(caught)} Bấm “Thử tải ảnh lại”.`);
      setSaving(false);
    }
  }

  const locked = !!pendingRecordId;
  return (
    <Sheet
      visible={visible}
      title="Hồ sơ y tế mới"
      onClose={close}
      footer={
        <Button
          label={saving ? 'Đang lưu…' : locked ? 'Thử tải ảnh lại' : 'Lưu hồ sơ'}
          icon="content-save-outline"
          loading={saving}
          onPress={() => void save()}
        />
      }
    >
      <Field label="Tiêu đề" value={title} onChangeText={setTitle} editable={!locked} placeholder="Ví dụ: Tái khám huyết áp" maxLength={200} />
      <Field label="Lý do khám" value={complaint} onChangeText={setComplaint} editable={!locked} multiline maxLength={2000} />
      <Field label="Ghi chú lâm sàng" value={notes} onChangeText={setNotes} editable={!locked} multiline />
      <View style={sectionStyles.block}>
        <Text style={sectionStyles.label}>
          Ảnh đính kèm * <Text style={sectionStyles.meta}>({images.length}/{MAX_IMAGES_PER_UPLOAD})</Text>
        </Text>
        <View style={sectionStyles.pickRow}>
          <View style={sectionStyles.flex}>
            <Button label="Chụp ảnh" icon="camera-outline" secondary onPress={() => void takePhoto()} disabled={saving || images.length >= MAX_IMAGES_PER_UPLOAD} />
          </View>
          <View style={sectionStyles.flex}>
            <Button label="Thư viện" icon="image-multiple-outline" secondary onPress={() => void pickFromLibrary()} disabled={saving || images.length >= MAX_IMAGES_PER_UPLOAD} />
          </View>
        </View>
        {images.length ? (
          <View style={sectionStyles.grid}>
            {images.map((image, index) => (
              <View key={`${image.uri}-${index}`}>
                <Image source={{ uri: image.uri }} style={sectionStyles.gridImage} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bỏ ảnh ${index + 1}`}
                  hitSlop={6}
                  disabled={saving}
                  onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                  style={sectionStyles.removeImage}
                >
                  <Icon name="close" size={16} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={sectionStyles.meta}>JPEG, PNG hoặc WebP · tối đa 10 MB/ảnh.</Text>
        )}
      </View>
      {formError ? <Message text={formError} error /> : null}
    </Sheet>
  );
}

// ================= Dị ứng =================

export function AllergySection({ patientId, canDelete, onChanged }: SectionProps) {
  const { items, loading, error, load } = useSectionList<Allergy>(`/patients/${patientId}/allergies`);
  const [formOpen, setFormOpen] = useState(false);

  async function remove(item: Allergy) {
    try {
      await api(`/allergies/${item.id}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (caught) {
      Alert.alert('Không thể xóa', errorMessage(caught));
    }
  }

  return (
    <View style={sectionStyles.stack}>
      <SectionHeader
        title="Dị ứng"
        count={items.length || undefined}
        action={<Button label="Ghi nhận" icon="plus" compact onPress={() => setFormOpen(true)} />}
      />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? (
        <Busy />
      ) : items.length ? (
        items.map((item) => {
          const tone = toneOf(severityTones[item.severity]);
          return (
            <View key={item.id} style={[sectionStyles.accentCard, { borderLeftColor: tone.fg }]}>
              <View style={sectionStyles.cardHead}>
                <View style={sectionStyles.cardHeadText}>
                  <Text style={sectionStyles.cardTitle}>{item.allergenName}</Text>
                  <View style={sectionStyles.badges}>
                    <Badge label={severityLabels[item.severity]} tone={severityTones[item.severity]} icon="alert-outline" />
                    <Badge label={allergyTypeLabels[item.type]} />
                  </View>
                </View>
                {canDelete ? (
                  <IconButton
                    icon="trash-can-outline"
                    label="Xóa dị ứng"
                    tone="danger"
                    onPress={() => confirmDelete('Xóa dị ứng?', `Xóa “${item.allergenName}” khỏi hồ sơ.`, () => remove(item))}
                  />
                ) : null}
              </View>
              {item.reaction ? <Text style={sectionStyles.body}>Phản ứng: {item.reaction}</Text> : null}
              {item.note ? <Text style={sectionStyles.body}>{item.note}</Text> : null}
              <Text style={sectionStyles.meta}>Ghi nhận {formatDate(item.recordedAt)}</Text>
            </View>
          );
        })
      ) : !error ? (
        <EmptyState icon="shield-check-outline" title="Chưa ghi nhận dị ứng" text="Hỏi bệnh nhân về dị ứng thuốc trước khi tư vấn." />
      ) : null}
      <AllergyFormSheet
        visible={formOpen}
        patientId={patientId}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await load();
          onChanged();
        }}
      />
    </View>
  );
}

function AllergyFormSheet({
  visible,
  patientId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  patientId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [reaction, setReaction] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<AllergyType>('MEDICATION');
  const [severity, setSeverity] = useState<AllergySeverity>('UNKNOWN');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  function reset() {
    setName('');
    setReaction('');
    setNote('');
    setType('MEDICATION');
    setSeverity('UNKNOWN');
    setFormError('');
  }

  async function save() {
    if (!name.trim()) {
      setFormError('Vui lòng nhập tác nhân dị ứng.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api(`/patients/${patientId}/allergies`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          allergenName: name.trim(),
          reaction: reaction.trim() || null,
          note: note.trim() || null,
          severity,
          recordedAt: new Date().toISOString(),
        }),
      });
      reset();
      await onSaved();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Ghi nhận dị ứng"
      onClose={() => {
        if (saving) return;
        reset();
        onClose();
      }}
      footer={<Button label={saving ? 'Đang lưu…' : 'Lưu dị ứng'} icon="content-save-outline" loading={saving} onPress={() => void save()} />}
    >
      <Field label="Tác nhân dị ứng *" value={name} onChangeText={setName} placeholder="Ví dụ: Penicillin, hải sản…" />
      <View>
        <Text style={sectionStyles.label}>Loại</Text>
        <View style={sectionStyles.chips}>
          {ALLERGY_TYPES.map((value) => (
            <Chip key={value} label={allergyTypeLabels[value]} selected={type === value} onPress={() => setType(value)} />
          ))}
        </View>
      </View>
      <View>
        <Text style={sectionStyles.label}>Mức độ</Text>
        <View style={sectionStyles.chips}>
          {ALLERGY_SEVERITIES.map((value) => (
            <Chip
              key={value}
              label={severityLabels[value]}
              tone={severityTones[value] === 'neutral' ? 'success' : severityTones[value]}
              selected={severity === value}
              onPress={() => setSeverity(value)}
            />
          ))}
        </View>
      </View>
      <Field label="Phản ứng" value={reaction} onChangeText={setReaction} multiline placeholder="Nổi mề đay, khó thở…" />
      <Field label="Ghi chú" value={note} onChangeText={setNote} multiline />
      {formError ? <Message text={formError} error /> : null}
    </Sheet>
  );
}

// ================= Bệnh lý =================

export function DiseaseSection({ patientId, canDelete, onChanged }: SectionProps) {
  const { items, loading, error, load } = useSectionList<PatientDisease>(`/patients/${patientId}/diseases`);
  const [formOpen, setFormOpen] = useState(false);

  async function remove(item: PatientDisease) {
    try {
      await api(`/patient-diseases/${item.id}`, { method: 'DELETE' });
      await load();
      onChanged();
    } catch (caught) {
      Alert.alert('Không thể xóa', errorMessage(caught));
    }
  }

  return (
    <View style={sectionStyles.stack}>
      <SectionHeader
        title="Bệnh lý"
        count={items.length || undefined}
        action={<Button label="Ghi nhận" icon="plus" compact onPress={() => setFormOpen(true)} />}
      />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {loading ? (
        <Busy />
      ) : items.length ? (
        items.map((item) => (
          <Card key={item.id}>
            <View style={sectionStyles.cardHead}>
              <View style={sectionStyles.cardHeadText}>
                <Text style={sectionStyles.cardTitle}>{item.disease?.name ?? 'Bệnh lý'}</Text>
                <View style={sectionStyles.badges}>
                  <Badge label={diseaseStatusLabels[item.status]} tone={diseaseStatusTones[item.status]} />
                  {item.disease?.code ? <Badge label={item.disease.code} /> : null}
                </View>
              </View>
              {canDelete ? (
                <IconButton
                  icon="trash-can-outline"
                  label="Xóa bệnh lý"
                  tone="danger"
                  onPress={() =>
                    confirmDelete('Xóa bệnh lý?', `Xóa “${item.disease?.name ?? 'bệnh lý'}” khỏi hồ sơ.`, () => remove(item))
                  }
                />
              ) : null}
            </View>
            {item.diagnosedAt ? <Text style={sectionStyles.meta}>Chẩn đoán {formatDate(item.diagnosedAt)}</Text> : null}
            {item.note ? <Text style={sectionStyles.body}>{item.note}</Text> : null}
          </Card>
        ))
      ) : !error ? (
        <EmptyState icon="heart-pulse" title="Chưa có bệnh lý được ghi nhận" />
      ) : null}
      <DiseaseFormSheet
        visible={formOpen}
        patientId={patientId}
        existingIds={items.filter((item) => item.status !== 'RESOLVED').map((item) => item.diseaseId)}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false);
          await load();
          onChanged();
        }}
      />
    </View>
  );
}

function DiseaseFormSheet({
  visible,
  patientId,
  existingIds,
  onClose,
  onSaved,
}: {
  visible: boolean;
  patientId: string;
  existingIds: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Disease[] | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [search, setSearch] = useState('');
  const [diseaseId, setDiseaseId] = useState('');
  const [status, setStatus] = useState<DiseaseStatus>('ACTIVE');
  const [diagnosedAt, setDiagnosedAt] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Chỉ tải danh mục khi mở form lần đầu.
  useEffect(() => {
    if (!visible || catalog) return;
    api<PageResult<Disease>>(`/diseases${query({ page: 1, limit: 100, isActive: true })}`)
      .then((result) => setCatalog(result.items))
      .catch((caught: unknown) => setCatalogError(errorMessage(caught)));
  }, [visible, catalog]);

  function reset() {
    setSearch('');
    setDiseaseId('');
    setStatus('ACTIVE');
    setDiagnosedAt('');
    setNote('');
    setFormError('');
  }

  const term = search.trim().toLocaleLowerCase('vi-VN');
  const filtered = (catalog ?? []).filter(
    (disease) =>
      !term ||
      disease.name.toLocaleLowerCase('vi-VN').includes(term) ||
      (disease.code ?? '').toLocaleLowerCase('vi-VN').includes(term),
  );
  const selected = catalog?.find((disease) => disease.id === diseaseId);

  async function save() {
    if (!diseaseId) {
      setFormError('Vui lòng chọn bệnh lý.');
      return;
    }
    const isoDate = diagnosedAt ? displayDateToIso(diagnosedAt) : null;
    if (diagnosedAt && !isoDate) {
      setFormError('Ngày chẩn đoán không hợp lệ (dd/mm/yyyy).');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await api(`/patients/${patientId}/diseases`, {
        method: 'POST',
        body: JSON.stringify({ diseaseId, status, diagnosedAt: isoDate, note: note.trim() || null }),
      });
      reset();
      await onSaved();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      visible={visible}
      title="Ghi nhận bệnh lý"
      onClose={() => {
        if (saving) return;
        reset();
        onClose();
      }}
      footer={<Button label={saving ? 'Đang lưu…' : 'Lưu bệnh lý'} icon="content-save-outline" loading={saving} onPress={() => void save()} />}
    >
      <View style={sectionStyles.block}>
        <Text style={sectionStyles.label}>Bệnh lý *</Text>
        {selected ? (
          <View style={sectionStyles.selected}>
            <Icon name="check-circle" size={20} color={colors.green} />
            <Text style={sectionStyles.selectedText}>
              {selected.name}
              {selected.code ? ` (${selected.code})` : ''}
            </Text>
            <Pressable hitSlop={8} onPress={() => setDiseaseId('')}>
              <Text style={sectionStyles.link}>Đổi</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Tìm theo tên hoặc mã bệnh" />
            {catalogError ? <Message text={catalogError} error /> : null}
            {!catalog && !catalogError ? <Busy label="Đang tải danh mục…" /> : null}
            <View style={sectionStyles.options}>
              {filtered.slice(0, 30).map((disease) => {
                const already = existingIds.includes(disease.id);
                return (
                  <Pressable
                    key={disease.id}
                    accessibilityRole="radio"
                    accessibilityState={{ disabled: already }}
                    disabled={already}
                    onPress={() => setDiseaseId(disease.id)}
                    style={({ pressed }) => [sectionStyles.option, already && sectionStyles.optionDisabled, pressed && sectionStyles.pressed]}
                  >
                    <View style={sectionStyles.flex}>
                      <Text style={sectionStyles.optionTitle}>{disease.name}</Text>
                      {already ? (
                        <Text style={sectionStyles.meta}>Đã có trong hồ sơ</Text>
                      ) : disease.code ? (
                        <Text style={sectionStyles.meta}>{disease.code}</Text>
                      ) : null}
                    </View>
                    <Icon name="radiobox-blank" size={20} color={colors.faint} />
                  </Pressable>
                );
              })}
              {catalog && !filtered.length ? <Text style={sectionStyles.meta}>Không tìm thấy bệnh lý phù hợp.</Text> : null}
              {filtered.length > 30 ? <Text style={sectionStyles.meta}>Nhập thêm từ khóa để thu hẹp kết quả.</Text> : null}
            </View>
          </>
        )}
      </View>
      <View>
        <Text style={sectionStyles.label}>Trạng thái</Text>
        <View style={sectionStyles.chips}>
          {DISEASE_STATUSES.map((value) => (
            <Chip key={value} label={diseaseStatusLabels[value]} selected={status === value} onPress={() => setStatus(value)} />
          ))}
        </View>
      </View>
      <Field
        label="Ngày chẩn đoán"
        value={diagnosedAt}
        onChangeText={(text) => setDiagnosedAt(maskDate(text))}
        keyboardType="number-pad"
        placeholder="dd/mm/yyyy"
        maxLength={10}
      />
      <Field label="Ghi chú" value={note} onChangeText={setNote} multiline />
      {formError ? <Message text={formError} error /> : null}
    </Sheet>
  );
}

const sectionStyles = StyleSheet.create({
  stack: { gap: 12 },
  flex: { flex: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardHeadText: { flex: 1, gap: 6 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  body: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  block: { gap: 6 },
  blockLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  link: { color: colors.green, fontSize: 14, fontWeight: '700' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pressed: { opacity: 0.72 },
  thumbs: { gap: 8 },
  thumb: { width: 84, height: 84, borderRadius: 12, backgroundColor: colors.background },
  accentCard: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderLeftWidth: 5,
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  pickRow: { flexDirection: 'row', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  gridImage: { width: 92, height: 92, borderRadius: 12, backgroundColor: colors.line },
  removeImage: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  viewerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  viewerText: { flex: 1, color: colors.white, fontSize: 14 },
  viewerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.mint,
  },
  selectedText: { flex: 1, color: colors.darkGreen, fontSize: 15, fontWeight: '700' },
  options: { gap: 6, marginTop: 6 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  optionDisabled: { opacity: 0.5 },
  optionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
});
