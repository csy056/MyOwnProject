import { type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, space } from './theme';

export function Screen({ children, scroll = true, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.scroll, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function T({ children, style, dim, faint, mono, size, center }: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  dim?: boolean;
  faint?: boolean;
  mono?: boolean;
  size?: number;
  center?: boolean;
}) {
  return (
    <Text
      style={[
        styles.text,
        dim && { color: colors.textDim },
        faint && { color: colors.textFaint },
        mono && { fontFamily: fonts.mono },
        size ? { fontSize: size, lineHeight: Math.round(size * 1.6) } : null,
        center && { textAlign: 'center' },
        style,
      ]}>
      {children}
    </Text>
  );
}

export function Button({ label, onPress, kind = 'default', disabled, testID, sub }: {
  label: string;
  onPress: () => void;
  kind?: 'default' | 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  testID?: string;
  sub?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && styles.btnPrimary,
        kind === 'ghost' && styles.btnGhost,
        kind === 'danger' && styles.btnDanger,
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
      ]}>
      <Text style={[styles.btnText, kind === 'primary' && { color: colors.bg }]}>{label}</Text>
      {sub ? <Text style={[styles.btnSub, kind === 'primary' && { color: colors.bgRaised }]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.back}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, padding: space.lg },
  scroll: { padding: space.lg, paddingBottom: space.xxl * 2 },
  text: { color: colors.text, fontSize: 16, lineHeight: 26, fontFamily: fonts.body },
  btn: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgRaised,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: 6,
    marginVertical: space.xs,
  },
  btnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  btnGhost: { backgroundColor: 'transparent' },
  btnDanger: { borderColor: colors.danger },
  btnText: { color: colors.text, fontSize: 16, fontFamily: fonts.body },
  btnSub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  card: { backgroundColor: colors.bgRaised, borderRadius: 8, padding: space.lg, borderWidth: 1, borderColor: colors.line, marginVertical: space.sm },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  back: { width: 40, height: 40, justifyContent: 'center' },
  backText: { color: colors.text, fontSize: 32, lineHeight: 36 },
  headerTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.body, fontWeight: '600' },
});
