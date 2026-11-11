import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { api, setAccessToken, setUnauthorizedHandler } from './src/api';
import { AccountScreen } from './src/screens/account';
import { DashboardScreen } from './src/screens/dashboard';
import { LoginScreen } from './src/screens/login';
import { PatientDetailScreen } from './src/screens/patient-detail';
import { PatientFormScreen, PatientsScreen } from './src/screens/patients';
import type { AuthUser, LoginResponse, Patient } from './src/types';
import { Busy, colors, Icon } from './src/ui';
import type { IconName } from './src/ui';

const tokenKey = 'pharmacy_access_token';
type Tab = 'home' | 'patients' | 'account';

/** Màn hình phủ lên trên tab (giống stack): chi tiết bệnh nhân và form. */
type Overlay = { kind: 'detail'; patientId: string } | { kind: 'form'; patient: Patient | null };

const tabs: { id: Tab; label: string; icon: IconName; activeIcon: IconName }[] = [
  { id: 'home', label: 'Tổng quan', icon: 'home-outline', activeIcon: 'home' },
  { id: 'patients', label: 'Bệnh nhân', icon: 'account-group-outline', activeIcon: 'account-group' },
  { id: 'account', label: 'Tài khoản', icon: 'account-circle-outline', activeIcon: 'account-circle' },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set(['home']));
  const [stack, setStack] = useState<Overlay[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusSearchKey, setFocusSearchKey] = useState(0);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setUser(null);
    setStack([]);
    setTab('home');
    setVisited(new Set(['home']));
    await SecureStore.deleteItemAsync(tokenKey).catch(() => undefined);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const token = await SecureStore.getItemAsync(tokenKey);
        if (token) {
          setAccessToken(token);
          const currentUser = await api<AuthUser>('/auth/me');
          if (active) setUser(currentUser);
        }
      } catch {
        setAccessToken(null);
        await SecureStore.deleteItemAsync(tokenKey).catch(() => undefined);
      } finally {
        if (active) setBooting(false);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);

  // Đăng ký listener một lần duy nhất và đọc state qua ref, để các màn hình con
  // (ví dụ form có thay đổi chưa lưu) đăng ký sau sẽ được ưu tiên xử lý trước.
  const navState = useRef({ stack, tab });
  navState.current = { stack, tab };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      const current = navState.current;
      if (current.stack.length) {
        setStack((value) => value.slice(0, -1));
        return true;
      }
      if (current.tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  async function login(email: string, password: string) {
    const result = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await SecureStore.setItemAsync(tokenKey, result.accessToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
  }

  function selectTab(next: Tab) {
    setTab(next);
    setVisited((current) => (current.has(next) ? current : new Set(current).add(next)));
  }
  const push = (overlay: Overlay) => setStack((value) => [...value, overlay]);
  const pop = () => setStack((value) => value.slice(0, -1));

  function saved(id: string) {
    setRefreshKey((current) => current + 1);
    setStack((value) => {
      const withoutForm = value.slice(0, -1);
      const top = withoutForm[withoutForm.length - 1];
      // Sửa từ trang chi tiết → quay về chi tiết; thêm mới → mở chi tiết bệnh nhân mới.
      return top?.kind === 'detail' && top.patientId === id
        ? withoutForm
        : [...withoutForm, { kind: 'detail', patientId: id }];
    });
  }

  const top = stack[stack.length - 1];

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <StatusBar style="dark" />
        {booting ? (
          <Busy label="Đang khởi động…" />
        ) : !user ? (
          <LoginScreen onLogin={login} />
        ) : (
          <>
            <View style={styles.content}>
              {/* Các tab được giữ mounted → không mất ô tìm kiếm/vị trí cuộn khi mở chi tiết. */}
              <View style={[styles.fill, tab !== 'home' && styles.hidden]}>
                <DashboardScreen
                  user={user}
                  refreshKey={refreshKey}
                  openPatient={(id) => push({ kind: 'detail', patientId: id })}
                  openPatients={() => selectTab('patients')}
                  openSearch={() => {
                    selectTab('patients');
                    setFocusSearchKey((value) => value + 1);
                  }}
                  openCreate={() => push({ kind: 'form', patient: null })}
                />
              </View>
              {visited.has('patients') ? (
                <View style={[styles.fill, tab !== 'patients' && styles.hidden]}>
                  <PatientsScreen
                    openPatient={(id) => push({ kind: 'detail', patientId: id })}
                    openCreate={() => push({ kind: 'form', patient: null })}
                    refreshKey={refreshKey}
                    focusSearchKey={focusSearchKey}
                  />
                </View>
              ) : null}
              {tab === 'account' ? <AccountScreen user={user} onLogout={() => void logout()} /> : null}

              {stack.map((overlay, index) => (
                <View
                  key={overlay.kind === 'detail' ? `detail-${overlay.patientId}-${refreshKey}` : `form-${index}`}
                  style={[styles.overlay, index !== stack.length - 1 && styles.hidden]}
                >
                  {overlay.kind === 'detail' ? (
                    <PatientDetailScreen
                      patientId={overlay.patientId}
                      canDelete={user.role === 'ADMIN'}
                      onBack={pop}
                      onEdit={(patient) => push({ kind: 'form', patient })}
                    />
                  ) : (
                    <PatientFormScreen patient={overlay.patient} onBack={pop} onSaved={saved} />
                  )}
                </View>
              ))}
            </View>
            {!top ? (
              <View style={styles.nav} accessibilityRole="tablist">
                {tabs.map((item) => {
                  const active = tab === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="tab"
                      accessibilityLabel={item.label}
                      accessibilityState={{ selected: active }}
                      onPress={() => selectTab(item.id)}
                      style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
                    >
                      <View style={[styles.navPill, active && styles.navPillActive]}>
                        <Icon name={active ? item.activeIcon : item.icon} size={22} color={active ? colors.green : colors.muted} />
                      </View>
                      <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  fill: { flex: 1 },
  hidden: { display: 'none' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background },
  nav: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  navItem: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navPill: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  navPillActive: { backgroundColor: colors.mint },
  navPressed: { opacity: 0.7 },
  navText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  navTextActive: { color: colors.green, fontWeight: '800' },
});
