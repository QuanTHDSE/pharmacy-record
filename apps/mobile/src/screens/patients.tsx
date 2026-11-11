import { GENDERS } from '@pharmacy-records/shared';
import type { Gender } from '@pharmacy-records/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { TextInputInstance } from 'react-native';
import { api, errorMessage, query } from '../api';
import { genderLabels, patientDemographics } from '../labels';
import type { PageResult, Patient } from '../types';
import {
  Avatar,
  Busy,
  Button,
  Card,
  Chip,
  colors,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  IconButton,
  Message,
  ScreenHeader,
  SearchBar,
  displayDateToIso,
  ageFrom,
  isoToDisplayDate,
  maskDate,
} from '../ui';

const PAGE_SIZE = 20;
type LoadMode = 'initial' | 'search' | 'refresh' | 'more';

export function PatientsScreen({
  openPatient,
  openCreate,
  refreshKey,
  focusSearchKey,
}: {
  openPatient: (id: string) => void;
  openCreate: () => void;
  refreshKey: number;
  /** Tăng giá trị này để tự focus ô tìm kiếm (ví dụ từ màn hình Tổng quan). */
  focusSearchKey: number;
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState<LoadMode | null>('initial');
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const hasItems = useRef(false);
  const searchRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (focusSearchKey > 0) searchRef.current?.focus();
  }, [focusSearchKey]);

  const fetchPage = useCallback(
    async (nextPage: number, mode: LoadMode) => {
      const id = ++requestId.current;
      setLoading(mode);
      setError('');
      try {
        const result = await api<PageResult<Patient>>(
          `/patients${query({ page: nextPage, limit: PAGE_SIZE, search: debouncedSearch })}`,
        );
        if (id !== requestId.current) return;
        setItems((previous) => {
          if (nextPage === 1) return result.items;
          const seen = new Set(previous.map((item) => item.id));
          return [...previous, ...result.items.filter((item) => !seen.has(item.id))];
        });
        hasItems.current = nextPage > 1 || result.items.length > 0;
        setPage(nextPage);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      } catch (caught) {
        if (id === requestId.current) setError(errorMessage(caught));
      } finally {
        if (id === requestId.current) setLoading(null);
      }
    },
    [debouncedSearch],
  );

  useEffect(() => {
    void fetchPage(1, hasItems.current ? 'search' : 'initial');
  }, [fetchPage, refreshKey]);

  function loadMore() {
    if (loading || error || page >= totalPages) return;
    void fetchPage(page + 1, 'more');
  }

  const showFullLoader = loading === 'initial' && !items.length;

  return (
    <View style={viewStyles.root}>
      <View style={viewStyles.top}>
        <View style={viewStyles.titleRow}>
          <View style={viewStyles.titleText}>
            <Text style={viewStyles.title}>Bệnh nhân</Text>
            <Text style={viewStyles.count}>
              {showFullLoader ? 'Đang tải…' : `${total} bệnh nhân${debouncedSearch ? ' phù hợp' : ''}`}
            </Text>
          </View>
          <IconButton icon="account-plus-outline" label="Thêm bệnh nhân" filled onPress={openCreate} />
        </View>
        <SearchBar
          inputRef={searchRef}
          value={search}
          onChangeText={setSearch}
          placeholder="Tìm theo tên, mã hoặc số điện thoại"
          loading={loading === 'search'}
        />
      </View>
      <FlatList
        style={viewStyles.list}
        contentContainerStyle={viewStyles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PatientRow patient={item} onPress={() => openPatient(item.id)} />}
        ItemSeparatorComponent={Separator}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={loading === 'refresh'}
            onRefresh={() => void fetchPage(1, 'refresh')}
            colors={[colors.green]}
            tintColor={colors.green}
          />
        }
        ListHeaderComponent={
          error && items.length ? (
            <View style={viewStyles.inlineError}>
              <Message text={error} error />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          showFullLoader ? (
            <Busy />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void fetchPage(1, 'initial')} />
          ) : loading ? undefined : (
            <EmptyState
              icon="account-search-outline"
              title={debouncedSearch ? 'Không có kết quả phù hợp' : 'Chưa có bệnh nhân'}
              text={
                debouncedSearch
                  ? 'Thử tìm bằng tên, mã bệnh nhân hoặc số điện thoại khác.'
                  : 'Thêm bệnh nhân đầu tiên để bắt đầu quản lý hồ sơ.'
              }
              action={
                debouncedSearch ? null : (
                  <Button label="Thêm bệnh nhân" icon="plus" compact onPress={openCreate} />
                )
              }
            />
          )
        }
        ListFooterComponent={
          loading === 'more' ? (
            <ActivityIndicator style={viewStyles.footer} color={colors.green} />
          ) : items.length && page >= totalPages && totalPages > 1 ? (
            <Text style={viewStyles.end}>Đã hiển thị tất cả {total} bệnh nhân</Text>
          ) : undefined
        }
      />
    </View>
  );
}

function Separator() {
  return <View style={viewStyles.separator} />;
}

export function PatientRow({ patient, onPress }: { patient: Patient; onPress: () => void }) {
  const demographics = patientDemographics(patient);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${patient.fullName}, ${patient.patientCode}`}
      onPress={onPress}
      style={({ pressed }) => [viewStyles.patientCard, pressed && viewStyles.pressed]}
    >
      <Avatar name={patient.fullName} />
      <View style={viewStyles.patientMain}>
        <Text style={viewStyles.patientName} numberOfLines={1}>
          {patient.fullName}
        </Text>
        <Text style={viewStyles.patientMeta} numberOfLines={1}>
          <Text style={viewStyles.patientCode}>{patient.patientCode}</Text>
          {demographics ? ` · ${demographics}` : ''}
        </Text>
        {patient.phone ? (
          <View style={viewStyles.phoneRow}>
            <Icon name="phone-outline" size={14} color={colors.muted} />
            <Text style={viewStyles.patientMeta}>{patient.phone}</Text>
          </View>
        ) : null}
      </View>
      <Icon name="chevron-right" size={22} color={colors.faint} />
    </Pressable>
  );
}

// ---------------- Form thêm / sửa bệnh nhân ----------------

type FieldErrors = Partial<Record<'fullName' | 'dateOfBirth' | 'phone', string>>;

export function PatientFormScreen({
  patient,
  onBack,
  onSaved,
}: {
  patient: Patient | null;
  onBack: () => void;
  onSaved: (id: string) => void;
}) {
  const initial = {
    fullName: patient?.fullName ?? '',
    dateOfBirth: isoToDisplayDate(patient?.dateOfBirth),
    gender: patient?.gender ?? null,
    phone: patient?.phone ?? '',
    address: patient?.address ?? '',
    note: patient?.note ?? '',
  };
  const [fullName, setFullName] = useState(initial.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(initial.dateOfBirth);
  const [gender, setGender] = useState<Gender | null>(initial.gender);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [note, setNote] = useState(initial.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const dirty =
    fullName !== initial.fullName ||
    dateOfBirth !== initial.dateOfBirth ||
    gender !== initial.gender ||
    phone !== initial.phone ||
    address !== initial.address ||
    note !== initial.note;

  const requestBack = useCallback(() => {
    if (!dirty || saving) {
      if (!saving) onBack();
      return;
    }
    Alert.alert('Bỏ thay đổi?', 'Các thông tin bạn vừa nhập sẽ không được lưu.', [
      { text: 'Tiếp tục nhập', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: onBack },
    ]);
  }, [dirty, saving, onBack]);

  // Đăng ký sau App nên được gọi trước → nút Back cứng cũng hỏi xác nhận.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestBack();
      return true;
    });
    return () => subscription.remove();
  }, [requestBack]);

  const isoDate = dateOfBirth ? displayDateToIso(dateOfBirth) : null;
  const age = isoDate ? ageFrom(isoDate) : null;

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (fullName.trim().length < 2) errors.fullName = 'Họ tên cần ít nhất 2 ký tự.';
    if (dateOfBirth && !isoDate) errors.dateOfBirth = 'Ngày sinh không hợp lệ (dd/mm/yyyy, không ở tương lai).';
    if (phone.trim() && !/^[0-9+().\s-]{7,20}$/.test(phone.trim()))
      errors.phone = 'Số điện thoại gồm 7–20 ký tự số.';
    return errors;
  }

  async function save() {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    setError('');
    try {
      const payload = {
        fullName: fullName.trim(),
        dateOfBirth: isoDate,
        gender,
        phone: phone.trim() || null,
        address: address.trim() || null,
        note: note.trim() || null,
      };
      const saved = await api<Patient>(patient ? `/patients/${patient.id}` : '/patients', {
        method: patient ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      onSaved(saved.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={viewStyles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title={patient ? 'Sửa bệnh nhân' : 'Thêm bệnh nhân'} onBack={requestBack} />
      <ScrollView contentContainerStyle={viewStyles.form} keyboardShouldPersistTaps="handled">
        {patient ? (
          <Text style={viewStyles.formSubtitle}>
            Mã bệnh nhân <Text style={viewStyles.patientCode}>{patient.patientCode}</Text>
          </Text>
        ) : (
          <Text style={viewStyles.formSubtitle}>Mã bệnh nhân sẽ được tạo tự động sau khi lưu.</Text>
        )}
        <Card>
          <Field
            label="Họ và tên *"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            placeholder="Nguyễn Văn An"
            error={fieldErrors.fullName}
          />
          <Field
            label="Ngày sinh"
            value={dateOfBirth}
            onChangeText={(text) => setDateOfBirth(maskDate(text))}
            keyboardType="number-pad"
            placeholder="dd/mm/yyyy"
            maxLength={10}
            error={fieldErrors.dateOfBirth}
            hint={age !== null ? `${age} tuổi` : 'Có thể để trống nếu chưa rõ.'}
          />
          <View>
            <Text style={viewStyles.label}>Giới tính</Text>
            <View style={viewStyles.chips} accessibilityRole="radiogroup">
              {GENDERS.map((value) => (
                <Chip
                  key={value}
                  label={genderLabels[value]}
                  selected={gender === value}
                  onPress={() => setGender(gender === value ? null : value)}
                />
              ))}
            </View>
          </View>
        </Card>
        <Card>
          <Field
            label="Số điện thoại"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="0901 234 567"
            error={fieldErrors.phone}
          />
          <Field label="Địa chỉ" value={address} onChangeText={setAddress} placeholder="Số nhà, đường, phường/xã…" />
          <Field
            label="Ghi chú"
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Thông tin cần lưu ý khi bán thuốc…"
          />
        </Card>
        {error ? <Message text={error} error /> : null}
      </ScrollView>
      <View style={viewStyles.formFooter}>
        <Button
          label={saving ? 'Đang lưu…' : patient ? 'Lưu thay đổi' : 'Thêm bệnh nhân'}
          icon="content-save-outline"
          loading={saving}
          disabled={patient ? !dirty : false}
          onPress={() => void save()}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const viewStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  top: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, gap: 14, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleText: { flex: 1, gap: 2 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  count: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 2, flexGrow: 1 },
  inlineError: { marginBottom: 10 },
  separator: { height: 10 },
  footer: { paddingVertical: 20 },
  end: { textAlign: 'center', color: colors.faint, fontSize: 12, paddingVertical: 18 },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  pressed: { opacity: 0.72 },
  patientMain: { flex: 1, gap: 3 },
  patientName: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  patientCode: { color: colors.green, fontWeight: '700' },
  patientMeta: { color: colors.muted, fontSize: 13 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  form: { padding: 20, paddingTop: 4, paddingBottom: 24, gap: 14 },
  formSubtitle: { color: colors.muted, fontSize: 14 },
  formFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
