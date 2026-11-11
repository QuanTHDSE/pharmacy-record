import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, errorMessage, query } from '../api';
import type { AuthUser, Disease, PageResult, Patient } from '../types';
import { Busy, colors, EmptyState, ErrorState, givenName, Icon, SectionHeader, Button } from '../ui';
import type { IconName } from '../ui';
import { PatientRow } from './patients';

function todayLabel(): string {
  const label = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function DashboardScreen({
  user,
  refreshKey,
  openPatient,
  openPatients,
  openSearch,
  openCreate,
}: {
  user: AuthUser;
  refreshKey: number;
  openPatient: (id: string) => void;
  openPatients: () => void;
  openSearch: () => void;
  openCreate: () => void;
}) {
  const [patients, setPatients] = useState<PageResult<Patient> | null>(null);
  const [diseases, setDiseases] = useState<PageResult<Disease> | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [patientResult, diseaseResult] = await Promise.all([
        api<PageResult<Patient>>(`/patients${query({ page: 1, limit: 5 })}`),
        api<PageResult<Disease>>(`/diseases${query({ page: 1, limit: 1, isActive: true })}`),
      ]);
      setPatients(patientResult);
      setDiseases(diseaseResult);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      contentContainerStyle={viewStyles.page}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          colors={[colors.green]}
          tintColor={colors.green}
        />
      }
    >
      <View style={viewStyles.header}>
        <Text style={viewStyles.date}>{todayLabel()}</Text>
        <Text style={viewStyles.title} numberOfLines={2}>
          Xin chào, {givenName(user.fullName)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Tìm bệnh nhân"
        onPress={openSearch}
        style={({ pressed }) => [viewStyles.searchShortcut, pressed && viewStyles.pressed]}
      >
        <Icon name="magnify" size={22} color={colors.muted} />
        <Text style={viewStyles.searchText}>Tìm theo tên, mã hoặc số điện thoại</Text>
      </Pressable>

      <View style={viewStyles.actions}>
        <QuickAction icon="account-plus-outline" label="Thêm bệnh nhân" onPress={openCreate} />
        <QuickAction icon="account-group-outline" label="Danh sách bệnh nhân" onPress={openPatients} />
      </View>

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!patients && !error ? <Busy /> : null}

      {patients && diseases ? (
        <>
          <View style={viewStyles.stats}>
            <Stat icon="account-group-outline" value={patients.pagination.total} label="Bệnh nhân" />
            <Stat icon="heart-pulse" value={diseases.pagination.total} label="Bệnh lý trong danh mục" tint={colors.blue} />
          </View>

          <View style={viewStyles.section}>
            <SectionHeader
              title="Mới tiếp nhận"
              action={
                patients.items.length ? (
                  <Button label="Xem tất cả" compact secondary onPress={openPatients} />
                ) : null
              }
            />
            {patients.items.length ? (
              <View style={viewStyles.list}>
                {patients.items.map((item) => (
                  <PatientRow key={item.id} patient={item} onPress={() => openPatient(item.id)} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="account-plus-outline"
                title="Chưa có bệnh nhân"
                text="Thêm bệnh nhân đầu tiên để bắt đầu."
                action={<Button label="Thêm bệnh nhân" icon="plus" compact onPress={openCreate} />}
              />
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [viewStyles.action, pressed && viewStyles.pressed]}
    >
      <View style={viewStyles.actionIcon}>
        <Icon name={icon} size={22} color={colors.white} />
      </View>
      <Text style={viewStyles.actionText}>{label}</Text>
    </Pressable>
  );
}

function Stat({
  icon,
  value,
  label,
  tint = colors.green,
}: {
  icon: IconName;
  value: number;
  label: string;
  tint?: string;
}) {
  return (
    <View style={viewStyles.statCard}>
      <Icon name={icon} size={22} color={tint} />
      <Text style={viewStyles.statValue}>{value.toLocaleString('vi-VN')}</Text>
      <Text style={viewStyles.statLabel}>{label}</Text>
    </View>
  );
}

const viewStyles = StyleSheet.create({
  page: { padding: 20, paddingBottom: 32, gap: 18, backgroundColor: colors.background, flexGrow: 1 },
  header: { gap: 4, paddingTop: 4 },
  date: { color: colors.green, fontSize: 13, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  searchShortcut: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  searchText: { flex: 1, color: colors.faint, fontSize: 15 },
  pressed: { opacity: 0.72 },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    minHeight: 96,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.darkGreen,
    justifyContent: 'space-between',
    gap: 10,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.white, fontSize: 14, fontWeight: '700', lineHeight: 19 },
  stats: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    gap: 6,
  },
  statValue: { fontSize: 26, color: colors.ink, fontWeight: '800' },
  statLabel: { fontSize: 12, lineHeight: 16, color: colors.muted },
  section: { gap: 12 },
  list: { gap: 10 },
});
