import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

const FILTERS = ["All", "Pending", "Approved", "Rejected", "Closed"] as const;

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default function Loans() {
  const router = useRouter();
  const { user } = useAuth();
  const canApprove = user?.role === "Admin" || user?.role === "Manager";
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ls, ms] = await Promise.all([api.listLoans(), api.listMembers()]);
      setItems(ls);
      setMembers(Object.fromEntries(ms.map((m: any) => [m.id, m.name])));
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(
    () => (filter === "All" ? items : items.filter((l) => l.status === filter)),
    [items, filter],
  );

  async function act(id: string, kind: "approve" | "reject") {
    try {
      if (kind === "approve") await api.approveLoan(id);
      else await api.rejectLoan(id);
      await load();
    } catch {}
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="loans-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Loans</Text>
        <Text style={styles.sub}>Track applications, EMIs & approvals</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            testID={`loan-filter-${f.toLowerCase()}`}
            onPress={() => setFilter(f)}
            style={[
              styles.chip,
              filter === f && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
            ]}
          >
            <Text style={[styles.chipText, filter === f && { color: colors.onBrandPrimary }]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.md, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={colors.muted} />
              <Text style={styles.emptyText}>No loans in this category.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const progress = item.total_payable
              ? Math.min(item.paid / item.total_payable, 1)
              : 0;
            return (
              <View style={styles.card} testID={`loan-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.loanNo}>{item.loan_no}</Text>
                    <Text style={styles.member}>{members[item.member_id] || "—"}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          item.status === "Approved" ? colors.brandTertiary
                          : item.status === "Pending" ? "#FFF3E0"
                          : item.status === "Rejected" ? "#FDECEA"
                          : colors.surfaceTertiary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color:
                            item.status === "Approved" ? colors.brandPrimary
                            : item.status === "Pending" ? colors.warning
                            : item.status === "Rejected" ? colors.error
                            : colors.onSurfaceTertiary,
                        },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowSplit}>
                  <View>
                    <Text style={styles.lbl}>Principal</Text>
                    <Text style={styles.val}>{fmt(item.amount)}</Text>
                  </View>
                  <View>
                    <Text style={styles.lbl}>EMI</Text>
                    <Text style={styles.val}>{fmt(item.emi)}/mo</Text>
                  </View>
                  <View>
                    <Text style={styles.lbl}>Tenure</Text>
                    <Text style={styles.val}>{item.tenure_months} mo</Text>
                  </View>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.progressTxt}>
                  Paid {fmt(item.paid)} / {fmt(item.total_payable)} (Interest {fmt(item.total_interest)})
                </Text>
                <Text style={styles.purpose}>Purpose: {item.purpose}</Text>

                {canApprove && item.status === "Pending" && (
                  <View style={styles.actions}>
                    <Pressable
                      testID={`reject-${item.id}`}
                      style={[styles.btn, styles.btnGhost]}
                      onPress={() => act(item.id, "reject")}
                    >
                      <Text style={styles.btnGhostText}>Reject</Text>
                    </Pressable>
                    <Pressable
                      testID={`approve-${item.id}`}
                      style={[styles.btn, styles.btnPrimary]}
                      onPress={() => act(item.id, "approve")}
                    >
                      <Text style={styles.btnPrimaryText}>Approve</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <Pressable
        testID="new-loan-fab"
        style={styles.fab}
        onPress={() => router.push("/loan-new" as any)}
      >
        <Ionicons name="add" size={28} color={colors.onBrandPrimary} />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  title: { fontSize: typography.xxl, fontWeight: "700", color: colors.onSurface },
  sub: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },

  chipsScroll: { maxHeight: 56, marginTop: spacing.md },
  chipsRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: "center" },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipText: { fontSize: typography.sm, fontWeight: "600", color: colors.onSurfaceTertiary },

  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  loanNo: { fontWeight: "700", color: colors.onSurface, fontSize: typography.base },
  member: { color: colors.muted, fontSize: typography.sm, marginTop: 2 },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  statusText: { fontSize: 11, fontWeight: "700" },

  rowSplit: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  lbl: { color: colors.muted, fontSize: typography.sm },
  val: { color: colors.onSurface, fontSize: typography.base, fontWeight: "700", marginTop: 2 },

  progressBar: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: spacing.md, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brandPrimary },
  progressTxt: { fontSize: typography.sm, color: colors.muted, marginTop: 6 },
  purpose: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginTop: spacing.xs },

  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: "center" },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnPrimaryText: { color: colors.onBrandPrimary, fontWeight: "700" },
  btnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  btnGhostText: { color: colors.onSurfaceTertiary, fontWeight: "600" },

  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  emptyText: { color: colors.muted, fontSize: typography.base, textAlign: "center" },

  fab: {
    position: "absolute", right: spacing.lg, bottom: 80,
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    ...shadow.card, elevation: 4,
  },
});
