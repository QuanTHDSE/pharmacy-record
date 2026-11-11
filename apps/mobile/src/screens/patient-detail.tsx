import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, query } from '../api';
import { genderLabels, patientDemographics, severityLabels, severityRank, severityTones } from '../labels';
import type { Allergy, PageResult, Patient } from '../types';
import {
  Avatar,
  Badge,
  Busy,
  Card,
  colors,
  ErrorState,
  formatDate,
  Icon,
  IconButton,
  InfoRow,
  ScreenHeader,
  SegmentedTabs,
} from '../ui';
import { AllergySection, DiseaseSection, RecordSection } from './patient-sections';

type Tab = 'overview' | 'records' | 'allergies' | 'diseases';

export function PatientDetailScreen({
  patientId,
  canDelete,
  onBack,
  onEdit,
}: {
  patientId: string;
  canDelete: boolean;
  onBack: () => void;
  onEdit: (patient: Patient) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sectionVersion, setSectionVersion] = useState(0);

  // Không bật lại spinner toàn màn hình khi tải lại → tránh nháy và mất vị trí cuộn.
  const load = useCallback(async () => {
    setError('');
    try {
      const [patientResult, allergyResult] = await Promise.all([
        api<Patient>(`/patients/${patientId}`),
        api<PageResult<Allergy>>(`/patients/${patientId}/allergies${query({ page: 1, limit: 50 })}`),
      ]);
      setPatient(patientResult);
      setAllergies(allergyResult.items);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setSectionVersion((value) => value + 1);
    setRefreshing(false);
  }

  const sortedAllergies = [...allergies].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity],
  );
  const hasSevere = allergies.some((item) => item.severity === 'SEVERE' || item.severity === 'MODERATE');
  const counts = patient?._count;

  return (
    <View style={viewStyles.root}>
      <ScreenHeader
        title="Hồ sơ bệnh nhân"
        onBack={onBack}
        right={
          patient ? (
            <IconButton icon="pencil-outline" label="Sửa thông tin bệnh nhân" onPress={() => onEdit(patient)} />
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={viewStyles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            colors={[colors.green]}
            tintColor={colors.green}
          />
        }
      >
        {!patient && !error ? <Busy /> : null}
        {error && !patient ? <ErrorState message={error} onRetry={() => void load()} /> : null}
        {patient ? (
          <>
            <View style={viewStyles.hero}>
              <Avatar name={patient.fullName} size={60} />
              <View style={viewStyles.heroInfo}>
                <Text style={viewStyles.name}>{patient.fullName}</Text>
                <Text style={viewStyles.meta}>
                  <Text style={viewStyles.code}>{patient.patientCode}</Text>
                  {patientDemographics(patient) ? ` · ${patientDemographics(patient)}` : ''}
                </Text>
              </View>
              {patient.phone ? (
                <IconButton
                  icon="phone"
                  label={`Gọi ${patient.phone}`}
                  tone="success"
                  onPress={() => void Linking.openURL(`tel:${patient.phone}`)}
                />
              ) : null}
            </View>

            <AllergyAlert allergies={sortedAllergies} onPress={() => setTab('allergies')} />

            <SegmentedTabs<Tab>
              value={tab}
              onChange={setTab}
              tabs={[
                { id: 'overview', label: 'Thông tin' },
                { id: 'records', label: 'Hồ sơ', count: counts?.medicalRecords },
                { id: 'allergies', label: 'Dị ứng', count: counts?.allergies ?? allergies.length, alert: hasSevere },
                { id: 'diseases', label: 'Bệnh lý', count: counts?.patientDiseases },
              ]}
            />

            {tab === 'overview' ? (
              <Card>
                <InfoRow
                  icon="cake-variant-outline"
                  label="Ngày sinh"
                  value={patient.dateOfBirth ? formatDate(patient.dateOfBirth) : null}
                />
                <InfoRow
                  icon="gender-male-female"
                  label="Giới tính"
                  value={patient.gender ? genderLabels[patient.gender] : null}
                />
                <InfoRow
                  icon="phone-outline"
                  label="Số điện thoại"
                  value={patient.phone}
                  actionIcon="phone"
                  onPress={patient.phone ? () => void Linking.openURL(`tel:${patient.phone}`) : undefined}
                />
                <InfoRow icon="map-marker-outline" label="Địa chỉ" value={patient.address} />
                <InfoRow icon="note-text-outline" label="Ghi chú" value={patient.note} />
                <View style={viewStyles.timestamps}>
                  <Text style={viewStyles.timestamp}>Tiếp nhận {formatDate(patient.createdAt)}</Text>
                  <Text style={viewStyles.timestamp}>Cập nhật {formatDate(patient.updatedAt)}</Text>
                </View>
              </Card>
            ) : null}
            {tab === 'records' ? (
              <RecordSection
                key={`records-${sectionVersion}`}
                patientId={patientId}
                canDelete={canDelete}
                onChanged={() => void load()}
              />
            ) : null}
            {tab === 'allergies' ? (
              <AllergySection
                key={`allergies-${sectionVersion}`}
                patientId={patientId}
                canDelete={canDelete}
                onChanged={() => void load()}
              />
            ) : null}
            {tab === 'diseases' ? (
              <DiseaseSection
                key={`diseases-${sectionVersion}`}
                patientId={patientId}
                canDelete={canDelete}
                onChanged={() => void load()}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Dị ứng là thông tin an toàn quan trọng nhất khi bán thuốc → luôn hiện ở đầu hồ sơ. */
function AllergyAlert({ allergies, onPress }: { allergies: Allergy[]; onPress: () => void }) {
  if (!allergies.length) {
    return (
      <View style={[viewStyles.alert, viewStyles.alertNone]}>
        <Icon name="shield-check-outline" size={20} color={colors.green} />
        <Text style={viewStyles.alertNoneText}>Chưa ghi nhận dị ứng</Text>
      </View>
    );
  }
  const shown = allergies.slice(0, 4);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Cảnh báo dị ứng: ${allergies.map((item) => item.allergenName).join(', ')}`}
      onPress={onPress}
      style={({ pressed }) => [viewStyles.alert, viewStyles.alertDanger, pressed && viewStyles.pressed]}
    >
      <View style={viewStyles.alertHead}>
        <Icon name="alert-octagon" size={20} color={colors.red} />
        <Text style={viewStyles.alertTitle}>Dị ứng ({allergies.length})</Text>
        <Icon name="chevron-right" size={20} color={colors.red} />
      </View>
      <View style={viewStyles.alertItems}>
        {shown.map((item) => (
          <Badge
            key={item.id}
            tone={severityTones[item.severity]}
            label={`${item.allergenName}${item.severity !== 'UNKNOWN' ? ` · ${severityLabels[item.severity]}` : ''}`}
          />
        ))}
        {allergies.length > shown.length ? <Badge label={`+${allergies.length - shown.length}`} /> : null}
      </View>
    </Pressable>
  );
}

const viewStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  page: { padding: 20, paddingTop: 4, paddingBottom: 32, gap: 14, flexGrow: 1 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroInfo: { flex: 1, gap: 3 },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13 },
  code: { color: colors.green, fontWeight: '800' },
  alert: { borderRadius: 16, padding: 12, gap: 8 },
  alertNone: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.mint },
  alertNoneText: { color: colors.darkGreen, fontSize: 14, fontWeight: '600' },
  alertDanger: { backgroundColor: colors.redTint, borderWidth: 1, borderColor: '#F1C9CC' },
  alertHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertTitle: { flex: 1, color: colors.red, fontSize: 15, fontWeight: '800' },
  alertItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timestamps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  timestamp: { color: colors.faint, fontSize: 12 },
  pressed: { opacity: 0.75 },
});
