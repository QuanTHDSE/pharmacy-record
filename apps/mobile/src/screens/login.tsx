import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextInputInstance } from 'react-native';
import { errorMessage } from '../api';
import { Button, Card, colors, Field, Icon, Message, Page } from '../ui';

export function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onLogin(email.trim(), password);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={viewStyles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Page>
        <View style={viewStyles.hero}>
          <View style={viewStyles.mark}>
            <Icon name="medical-bag" size={28} color={colors.white} />
          </View>
          <Text style={viewStyles.brand}>Pharmacy Records</Text>
          <Text style={viewStyles.tagline}>Tra cứu hồ sơ, dị ứng và bệnh lý của bệnh nhân ngay tại quầy.</Text>
        </View>
        <Card>
          <View style={viewStyles.headingBlock}>
            <Text style={viewStyles.heading}>Đăng nhập</Text>
            <Text style={viewStyles.description}>Sử dụng tài khoản nhà thuốc của bạn.</Text>
          </View>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="username"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <View>
            <Field
              inputRef={passwordRef}
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              style={viewStyles.passwordInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              hitSlop={8}
              onPress={() => setShowPassword((value) => !value)}
              style={viewStyles.eye}
            >
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
            </Pressable>
          </View>
          {error ? <Message text={error} error /> : null}
          <Button
            label={busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            icon="login"
            loading={busy}
            onPress={() => void submit()}
          />
        </Card>
      </Page>
    </KeyboardAvoidingView>
  );
}

const viewStyles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    backgroundColor: colors.darkGreen,
    padding: 24,
    borderRadius: 24,
    minHeight: 180,
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  brand: { color: colors.white, fontSize: 26, fontWeight: '800' },
  tagline: { color: '#D4E9DE', fontSize: 14, lineHeight: 21 },
  headingBlock: { gap: 4, marginBottom: 4 },
  heading: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 14 },
  passwordInput: { paddingRight: 48 },
  eye: { position: 'absolute', right: 12, top: 34, height: 34, justifyContent: 'center' },
});
