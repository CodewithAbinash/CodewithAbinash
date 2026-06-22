import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Login() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@coopassam.in");
  const [password, setPassword] = useState("Admin@123");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit() {
    setErr(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function fill(e: string, p: string) {
    setEmail(e);
    setPassword(p);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfaceInverse }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Image
        source={{
          uri: "https://images.unsplash.com/photo-1758390286286-9b3b690989e7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxBc3NhbSUyMGxhbmRzY2FwZSUyMHRlYSUyMGdhcmRlbiUyMG5hdHVyZXxlbnwwfHx8fDE3ODIwNTc2NDd8MA&ixlib=rb-4.1.0&q=85",
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(26,26,26,0.4)", "rgba(26,26,26,0.95)"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={28} color={colors.onBrandPrimary} />
          </View>
          <Text style={styles.brandTitle}>Assam Co-op Connect</Text>
          <Text style={styles.brandSub}>
            Credit Co-operative Society Management
          </Text>
        </View>

        <View style={styles.card} testID="login-card">
          <Text style={styles.cardTitle}>Sign in to your society</Text>
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            placeholder="you@society.in"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />

          {err && (
            <Text style={styles.err} testID="login-error">
              {err}
            </Text>
          )}

          <Pressable
            testID="login-submit-button"
            style={[styles.cta, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={onSubmit}
          >
            {loading ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaText}>Sign in</Text>
            )}
          </Pressable>

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Quick demo accounts</Text>
            <Pressable
              testID="demo-admin"
              style={styles.demoRow}
              onPress={() => fill("admin@coopassam.in", "Admin@123")}
            >
              <Ionicons name="shield-checkmark" size={16} color={colors.brandPrimary} />
              <Text style={styles.demoText}>Admin / Secretary</Text>
            </Pressable>
            <Pressable
              testID="demo-manager"
              style={styles.demoRow}
              onPress={() => fill("manager@coopassam.in", "Manager@123")}
            >
              <Ionicons name="briefcase" size={16} color={colors.brandPrimary} />
              <Text style={styles.demoText}>Branch Manager</Text>
            </Pressable>
            <Pressable
              testID="demo-agent"
              style={styles.demoRow}
              onPress={() => fill("agent@coopassam.in", "Agent@123")}
            >
              <Ionicons name="bicycle" size={16} color={colors.brandPrimary} />
              <Text style={styles.demoText}>Field Collection Agent</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "flex-end", padding: spacing.lg },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  logoCircle: {
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  brandTitle: { color: "#fff", fontSize: typography.xxl, fontWeight: "700" },
  brandSub: { color: "rgba(255,255,255,0.85)", fontSize: typography.base, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg, padding: spacing.lg, ...shadow.card,
  },
  cardTitle: { fontSize: typography.xl, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.lg },
  label: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.lg, color: colors.onSurface, backgroundColor: colors.surface,
  },
  err: { color: colors.error, fontSize: typography.base, marginTop: spacing.md },
  cta: {
    marginTop: spacing.lg, backgroundColor: colors.brandPrimary,
    paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center",
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: typography.lg, fontWeight: "700" },
  demoBox: {
    marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
  },
  demoTitle: { fontSize: typography.sm, fontWeight: "600", color: colors.onBrandTertiary, marginBottom: spacing.sm },
  demoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.sm },
  demoText: { fontSize: typography.base, color: colors.onBrandTertiary },
});
