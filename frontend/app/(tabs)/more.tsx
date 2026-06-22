import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

const MENU: { key: string; icon: keyof typeof Ionicons.glyphMap; label: string; desc: string; href: string; roles?: string[] }[] = [
  { key: "deposits", icon: "wallet", label: "Savings & Deposits", desc: "RD, FD, Daily/Pigmy accounts", href: "/deposits" },
  { key: "collections", icon: "bicycle", label: "Field Collection", desc: "Agent daily ledger", href: "/collections" },
  { key: "notices", icon: "megaphone", label: "Notices & AGM", desc: "Circulars and meeting notices", href: "/notices" },
  { key: "rules", icon: "book", label: "Assam Co-op Rules", desc: "Compliance reference (Act 2007)", href: "/rules" },
  { key: "settings", icon: "settings", label: "Society Settings", desc: "Society profile & rates", href: "/settings" },
  { key: "profile", icon: "person-circle", label: "Profile & Sign Out", desc: "Account, sign out", href: "/profile" },
];

export default function More() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="more-screen">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.sub}>Signed in as {user?.name}</Text>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {MENU.map((it) => (
            <Pressable
              key={it.key}
              testID={`more-${it.key}`}
              style={styles.row}
              onPress={() => router.push(it.href as any)}
            >
              <View style={styles.iconBox}>
                <Ionicons name={it.icon} size={22} color={colors.brandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{it.label}</Text>
                <Text style={styles.desc}>{it.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  title: { fontSize: typography.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, ...shadow.card,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: typography.lg, fontWeight: "600", color: colors.onSurface },
  desc: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },
});
