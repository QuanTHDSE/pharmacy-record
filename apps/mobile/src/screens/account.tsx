import { Alert, StyleSheet, Text, View } from 'react-native';
import { roleLabels } from '../labels';
import type { AuthUser } from '../types';
import { Avatar, Badge, Button, Card, colors, Heading, InfoRow, Page } from '../ui';

export function AccountScreen({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  function confirmLogout() {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại để tiếp tục tra cứu hồ sơ.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: onLogout },
    ]);
  }

  return (
    <Page>
      <Heading title="Tài khoản" />
      <View style={viewStyles.profile}>
        <Avatar name={user.fullName} size={72} />
        <Text style={viewStyles.name}>{user.fullName}</Text>
        <Badge label={roleLabels[user.role]} tone={user.role === 'ADMIN' ? 'info' : 'success'} icon="shield-account-outline" />
      </View>
      <Card>
        <InfoRow icon="email-outline" label="Email" value={user.email} />
        <InfoRow icon="badge-account-outline" label="Vai trò" value={roleLabels[user.role]} />
      </Card>
      <Text style={viewStyles.note}>
        Phiên đăng nhập được lưu an toàn trên thiết bị. Hãy đăng xuất khi dùng chung điện thoại.
      </Text>
      <Button label="Đăng xuất" icon="logout" secondary danger onPress={confirmLogout} />
    </Page>
  );
}

const viewStyles = StyleSheet.create({
  profile: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800', textAlign: 'center' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
});
