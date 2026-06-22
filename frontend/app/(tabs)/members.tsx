import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Members() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setItems(await api.listMembers()); } catch {}
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (m) =>
        m.name?.toLowerCase().includes(s) ||
        m.member_no?.toLowerCase().includes(s) ||
        m.phone?.includes(s),
    );
  }, [items, q]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="members-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Members</Text>
        <Text style={styles.sub}>{items.length} registered</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          testID="members-search"
          style={styles.searchInput}
          placeholder="Search by name, ID or phone"
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No members yet. Add the first one.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const initials = item.name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Pressable
                testID={`member-row-${item.id}`}
                style={styles.row}
                onPress={() => router.push(`/member/${item.id}` as any)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.member_no} • {item.phone}
                  </Text>
                  <Text style={styles.meta}>
                    {item.village ? `${item.village}, ` : ""}{item.district}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        testID="add-member-fab"
        style={styles.fab}
        onPress={() => router.push("/member-new" as any)}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: typography.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },
  searchBox: {
    marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingHorizontal: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, paddingVertical: spacing.md, color: colors.onSurface, fontSize: typography.base },
  row: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, gap: spacing.md, ...shadow.card,
  },
  avatar: {
    width: 44, height: 44, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontWeight: "700", color: colors.brandPrimary },
  name: { fontSize: typography.lg, fontWeight: "600", color: colors.onSurface },
  meta: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: typography.base, textAlign: "center" },
  fab: {
    position: "absolute", right: spacing.lg, bottom: 80,
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    ...shadow.card, elevation: 4,
  },
});
