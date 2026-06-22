import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Collections() {
  const [members, setMembers] = useState<any[]>([]);
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(0);

  const load = useCallback(async () => {
    try { setMembers(await api.listMembers()); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submitLedger() {
    setSubmitting(true);
    let ok = 0;
    for (const [mid, amtS] of Object.entries(entries)) {
      const amt = parseFloat(amtS);
      if (!amt) continue;
      try {
        await api.addTxn({ member_id: mid, type: "Deposit", amount: amt, mode: "Cash", note: "Field collection" });
        ok += 1;
      } catch {}
    }
    setDone(ok);
    setEntries({});
    setSubmitting(false);
  }

  const total = Object.values(entries).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Daily Collection" subtitle="Field agent ledger • Offline-friendly" />
      {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={() => done > 0 ? (
            <View style={styles.banner} testID="collection-banner">
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={styles.bannerText}>{done} entries posted in last ledger.</Text>
            </View>
          ) : null}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="bicycle-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyT}>No members assigned.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`collect-${item.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.member_no} • {item.village || item.district}</Text>
              </View>
              <View style={styles.amountBox}>
                <Text style={{ color: colors.muted, marginRight: 4 }}>₹</Text>
                <TextInput
                  testID={`collect-input-${item.id}`}
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                  value={entries[item.id] ?? ""}
                  onChangeText={(v) => setEntries((e) => ({ ...e, [item.id]: v }))}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}
        />
      )}
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: typography.sm }}>Total today</Text>
          <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: typography.xl }}>₹ {total.toFixed(0)}</Text>
        </View>
        <Pressable testID="submit-ledger" style={[styles.cta, (!total || submitting) && { opacity: 0.5 }]}
          disabled={!total || submitting} onPress={submitLedger}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Submit Ledger</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md, marginBottom: spacing.md },
  bannerText: { color: colors.brandPrimary, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, ...shadow.card },
  name: { fontWeight: "600", color: colors.onSurface },
  meta: { color: colors.muted, fontSize: typography.sm, marginTop: 2 },
  amountBox: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, minWidth: 120 },
  amountInput: { flex: 1, paddingVertical: spacing.sm, color: colors.onSurface, fontSize: typography.lg, fontWeight: "700", textAlign: "right" },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  emptyT: { color: colors.muted },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center", minWidth: 160 },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: typography.lg },
});
