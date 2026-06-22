import { View, Text, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Profile() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function logout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Profile" />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={styles.card} testID="profile-card">
          <View style={styles.avatar}>
            <Text style={{ fontWeight: "800", color: colors.brandPrimary, fontSize: 22 }}>
              {user?.name?.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </Text>
          </View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.rolePill}>
            <Ionicons name="shield-checkmark" size={14} color={colors.brandPrimary} />
            <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>{user?.role}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Info icon="call" k="Phone" v={user?.phone ?? "—"} />
          <Info icon="business" k="Society" v="Assam Co-op Connect" />
        </View>

        <Pressable testID="logout-btn" style={styles.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={{ color: colors.error, fontWeight: "700", fontSize: typography.lg }}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Info({ icon, k, v }: { icon: any; k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
      <Ionicons name={icon} size={18} color={colors.brandPrimary} />
      <Text style={{ flex: 1, color: colors.muted }}>{k}</Text>
      <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radius.md, alignItems: "center", ...shadow.card },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  name: { fontSize: typography.xl, fontWeight: "700", color: colors.onSurface },
  email: { color: colors.muted, marginTop: 2 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandTertiary, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
});
