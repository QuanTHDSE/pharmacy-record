import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import type { ComponentProps, PropsWithChildren, ReactNode, Ref } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextInputInstance, TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const colors = {
  green: '#176B52',
  darkGreen: '#124B3D',
  mint: '#E7F4EE',
  ink: '#18312B',
  muted: '#5F706A',
  faint: '#879790',
  line: '#E1E9E5',
  background: '#F4F7F5',
  white: '#ffffff',
  red: '#A6363D',
  redTint: '#FCEEEF',
  amber: '#8A5A00',
  amberTint: '#FFF4DB',
  blue: '#2F6C82',
  blueTint: '#E8F2F6',
};

export type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

const toneColors: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.muted, bg: '#EEF2F0' },
  success: { fg: colors.green, bg: colors.mint },
  info: { fg: colors.blue, bg: colors.blueTint },
  warning: { fg: colors.amber, bg: colors.amberTint },
  danger: { fg: colors.red, bg: colors.redTint },
};

export function toneOf(tone: Tone) {
  return toneColors[tone];
}

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function Page({ children }: PropsWithChildren) {
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children, tone }: PropsWithChildren<{ tone?: Tone }>) {
  return (
    <View
      style={[
        styles.card,
        tone && { backgroundColor: toneColors[tone].bg, borderColor: toneColors[tone].bg },
      ]}
    >
      {children}
    </View>
  );
}

export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** Thanh tiêu đề cho màn hình con: nút quay lại, tiêu đề, hành động bên phải. */
export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      {onBack ? (
        <IconButton icon="arrow-left" label="Quay lại" onPress={onBack} />
      ) : (
        <View style={styles.iconButtonSpacer} />
      )}
      <Text style={styles.screenHeaderTitle} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.iconButtonSpacer} />}
    </View>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  tone,
  filled,
  disabled,
}: {
  icon: IconName;
  /** Bắt buộc: dùng cho trình đọc màn hình. */
  label: string;
  onPress: () => void;
  tone?: Tone;
  filled?: boolean;
  disabled?: boolean;
}) {
  const color = filled ? colors.white : tone ? toneColors[tone].fg : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        filled && styles.iconButtonFilled,
        !filled && tone && { backgroundColor: toneColors[tone].bg },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={22} color={color} />
    </Pressable>
  );
}

export function Field({
  label,
  multiline,
  onFocus,
  onBlur,
  error,
  hint,
  inputRef,
  style,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; inputRef?: Ref<TextInputInstance> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        ref={inputRef}
        accessibilityLabel={label}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={colors.faint}
        style={[
          styles.input,
          focused && styles.inputFocused,
          !!error && styles.inputError,
          multiline && styles.multiline,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : hint ? (
        <Text style={styles.fieldHint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  loading,
  inputRef,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  loading?: boolean;
  inputRef?: Ref<TextInputInstance>;
}) {
  return (
    <View style={styles.search}>
      <Icon name="magnify" size={22} color={colors.muted} />
      <TextInput
        ref={inputRef}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.searchInput}
      />
      {loading ? <ActivityIndicator size="small" color={colors.green} /> : null}
      {value && !loading ? (
        <Pressable accessibilityLabel="Xóa tìm kiếm" hitSlop={10} onPress={() => onChangeText('')}>
          <Icon name="close-circle" size={20} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  secondary,
  danger,
  icon,
  compact,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
  icon?: IconName;
  compact?: boolean;
  loading?: boolean;
}) {
  const fg = secondary ? (danger ? colors.red : colors.darkGreen) : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        secondary && styles.buttonSecondary,
        danger && (secondary ? styles.buttonDangerSecondary : styles.buttonDanger),
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : icon ? (
        <Icon name={icon} size={compact ? 18 : 20} color={fg} />
      ) : null}
      <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: fg }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tone,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: Tone;
}) {
  const active = toneColors[tone ?? 'success'];
  return (
    <Pressable
      accessibilityRole="radio"
      onPress={onPress}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && { borderColor: active.fg, backgroundColor: active.bg },
        pressed && styles.pressed,
      ]}
    >
      {selected ? <Icon name="check" size={16} color={active.fg} /> : null}
      <Text style={[styles.chipText, selected && { color: active.fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const palette = toneColors[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      {icon ? <Icon name={icon} size={14} color={palette.fg} /> : null}
      <Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Message({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={[styles.message, error && styles.messageError]}>
      <Icon
        name={error ? 'alert-circle-outline' : 'information-outline'}
        size={18}
        color={error ? colors.red : colors.green}
      />
      <Text style={[styles.messageText, error && styles.error]}>{text}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <Message text={message} error />
      <Button label="Thử lại" icon="refresh" secondary onPress={onRetry} />
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.green} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action}
    </View>
  );
}

export function Busy({ label = 'Đang tải dữ liệu…' }: { label?: string }) {
  return (
    <View style={styles.busy}>
      <ActivityIndicator color={colors.green} size="large" />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  );
}

export function Row({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color={colors.muted} /> : null}
    </Pressable>
  );
}

/** Dòng thông tin dạng "nhãn trên – giá trị dưới", có icon. */
export function InfoRow({
  icon,
  label,
  value,
  onPress,
  actionIcon,
}: {
  icon: IconName;
  label: string;
  value: string | null | undefined;
  onPress?: () => void;
  actionIcon?: IconName;
}) {
  const empty = !value;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
    >
      <View style={styles.infoIcon}>
        <Icon name={icon} size={19} color={colors.green} />
      </View>
      <View style={styles.rowMain}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, empty && styles.infoValueEmpty]}>
          {value || 'Chưa cập nhật'}
        </Text>
      </View>
      {onPress && actionIcon ? <Icon name={actionIcon} size={20} color={colors.green} /> : null}
    </Pressable>
  );
}

export function SectionHeader({
  title,
  count,
  action,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        {title}
        {count !== undefined ? <Text style={styles.sectionCount}>  {count}</Text> : null}
      </Text>
      {action}
    </View>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number; alert?: boolean }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, active && styles.segmentTextActive]}>
              {tab.label}
            </Text>
            {tab.count ? (
              <View style={[styles.segmentCount, tab.alert && styles.segmentCountAlert]}>
                <Text style={[styles.segmentCountText, tab.alert && styles.segmentCountTextAlert]}>
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet dùng Modal gốc của React Native – không cần thư viện ngoài. */
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
  footer?: ReactNode;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.sheetRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable accessibilityLabel="Đóng" style={styles.sheetBackdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <IconButton icon="close" label="Đóng" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Avatar({ name, size = 46 }: { name: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials(name)}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  heading: { gap: 4 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  screenHeaderTitle: { flex: 1, textAlign: 'center', color: colors.ink, fontSize: 17, fontWeight: '800' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonFilled: { backgroundColor: colors.green },
  iconButtonSpacer: { width: 44, height: 44 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 7 },
  field: { gap: 0 },
  input: {
    minHeight: 50,
    backgroundColor: colors.white,
    borderColor: colors.line,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 16,
  },
  inputFocused: { borderColor: colors.green },
  inputError: { borderColor: colors.red },
  multiline: { minHeight: 92, textAlignVertical: 'top', paddingVertical: 12 },
  fieldError: { color: colors.red, fontSize: 13, marginTop: 6 },
  fieldHint: { color: colors.muted, fontSize: 12, marginTop: 6 },
  search: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: 10 },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonCompact: { minHeight: 40, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  buttonSecondary: { backgroundColor: colors.mint },
  buttonDanger: { backgroundColor: colors.red },
  buttonDangerSecondary: { backgroundColor: colors.redTint },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.72 },
  buttonText: { fontWeight: '700', fontSize: 15 },
  buttonTextCompact: { fontSize: 14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 99,
    paddingHorizontal: 14,
    minHeight: 42,
    backgroundColor: colors.white,
  },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  message: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.mint,
  },
  messageError: { backgroundColor: colors.redTint },
  messageText: { flex: 1, color: colors.darkGreen, fontSize: 14, lineHeight: 20 },
  error: { color: colors.red },
  busy: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 6 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  infoValue: { color: colors.ink, fontSize: 15, lineHeight: 21 },
  infoValueEmpty: { color: colors.faint, fontStyle: 'italic' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  sectionCount: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    borderRadius: 16,
    backgroundColor: '#E6ECE9',
  },
  segment: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  segmentTextActive: { color: colors.ink },
  segmentCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: '#D5DFDA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountAlert: { backgroundColor: colors.red },
  segmentCountText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  segmentCountTextAlert: { color: colors.white },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(10, 30, 24, 0.45)',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#C9D4CF',
    marginTop: 8,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 10,
    paddingTop: 4,
  },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
  sheetBody: { padding: 20, paddingTop: 8, gap: 16 },
  sheetFooter: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  avatar: { backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.green, fontWeight: '800' },
});

// ---------- Định dạng & tiện ích ----------

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
}

/** "Nguyễn Văn An" → "NA" (họ + tên gọi). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : '';
  return (first + last).toUpperCase();
}

/** Tên gọi tiếng Việt là từ cuối cùng. */
export function givenName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function ageFrom(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

/** Gõ "20051990" → "20/05/1990". */
export function maskDate(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
}

/** "20/05/1990" → "1990-05-20"; trả về null nếu ngày không hợp lệ hoặc ở tương lai. */
export function displayDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(Date.UTC(year, month - 1, day));
  const valid =
    year >= 1900 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getTime() <= Date.now();
  return valid ? `${yyyy}-${mm}-${dd}` : null;
}

/** "1990-05-20…" → "20/05/1990". */
export function isoToDisplayDate(value: string | null | undefined): string {
  if (!value) return '';
  const [yyyy, mm, dd] = value.slice(0, 10).split('-');
  return yyyy && mm && dd ? `${dd}/${mm}/${yyyy}` : '';
}
