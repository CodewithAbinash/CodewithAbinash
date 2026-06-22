import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

type TYPE = "RD" | "FD" | "DD";
const TYPES: TYPE[] = ["RD", "FD", "DD"];
const LABELS: Record<TYPE, string> = { RD: "Recurring Deposit", FD: "Fixed Deposit", DD: "Daily/Pigmy" };

function fmt(n: number) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export default function Deposits() {
  const [tab, setTab] = useState<"list" | "new">("list");
  const [items, setItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [memberId, setMemberId] = useState("");
  const [type, setType] = useState<TYPE>("RD");
  const [principal, setPrincipal] = useState("1000");
  const [rate, setRate] = useState("7");
  const [tenure, setTenure] = useState("12");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([api.listAccounts(), api.listMembers()]);
      setItems(a); setMembers(m);
      if (!memberId && m[0]) setMemberId(m[0].id);
    } catch {} finally { setLoading(false); }
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    setBusy(true);
    try {
      await api.addAccount({
        member_id: memberId, account_type: type,
        principal: parseFloat(principal), interest_rate: parseFloat(rate),
        tenure_months: parseInt(tenure, 10),
      });
      setTab("list"); load();
    } catch {} finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Savings & Deposits" subtitle="RD • FD • Pigmy" />
      <View style={styles.tabRow}>
        {(["list", "new"] as const).map((t) => (
          <Pressable key={t} testID={`deposit-tab-${t}`} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: colors.onBrandPrimary }]}>{t === "list" ? "Accounts" : "New"}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "list" ? (
        loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
          <FlatList
            data={items}
            keyExtractor={(a) => a.id}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            ListEmptyComponent={() => (
              <View style={styles.empty}>
                <Ionicons name="wallet-outline" size={48} color={colors.muted} />
                <Text style={styles.emptyT}>No deposit accounts yet.</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const mem = members.find((m) => m.id === item.member_id);
              return (
                <View style={styles.card} testID={`acc-${item.id}`}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={[styles.typePill, { backgroundColor: colors.brandTertiary }]}>
                      <Text style={[styles.typePillT, { color: colors.brandPrimary }]}>{item.account_type}</Text>
                    </View>
                    <View style={{ marginLeft: spacing.md, flex: 1 }}>
                      <Text style={styles.accNo}>{item.account_no}</Text>
                      <Text style={styles.member}>{mem?.name ?? "—"}</Text>
                    </View>
                    <Text style={styles.balance}>{fmt(item.balance)}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.meta}>Rate {item.interest_rate}% p.a.</Text>
                    <Text style={styles.meta}>Tenure {item.tenure_months} mo</Text>
                    <Text style={styles.meta}>{item.status}</Text>
                  </View>
                </View>
              );
            }}
          />
        )
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          <Text style={styles.label}>Member</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
            {members.map((m) => (
              <Pressable key={m.id} onPress={() => setMemberId(m.id)}
                style={[styles.chip, memberId === m.id && styles.chipActive]}>
                <Text style={[styles.chipText, memberId === m.id && { color: "#fff" }]}>{m.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Account type</Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            {TYPES.map((t) => (
              <Pressable key={t} testID={`type-${t}`} onPress={() => setType(t)}
                style={[styles.typeCard, type === t && styles.typeCardActive]}>
                <Text style={[styles.typeT, type === t && { color: "#fff" }]}>{t}</Text>
                <Text style={[styles.typeL, type === t && { color: "rgba(255,255,255,0.85)" }]}>{LABELS[t]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Initial deposit (₹)</Text>
          <TextInput testID="acc-principal" style={styles.input} keyboardType="decimal-pad"
            value={principal} onChangeText={setPrincipal} />

          <Text style={styles.label}>Interest rate (% p.a.)</Text>
          <TextInput testID="acc-rate" style={styles.input} keyboardType="decimal-pad" value={rate} onChangeText={setRate} />

          <Text style={styles.label}>Tenure (months)</Text>
          <TextInput testID="acc-tenure" style={styles.input} keyboardType="number-pad" value={tenure} onChangeText={setTenure} />

          <Pressable testID="open-account" style={[styles.cta, { marginTop: spacing.lg }]} disabled={busy || !memberId} onPress={submit}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Open account</Text>}
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", margin: spacing.lg, backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.pill },
  tabActive: { backgroundColor: colors.brandPrimary },
  tabText: { fontWeight: "700", color: colors.onSurfaceTertiary },
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, ...shadow.card },
  typePill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  typePillT: { fontWeight: "800", fontSize: typography.sm },
  accNo: { fontWeight: "700", color: colors.onSurface },
  member: { color: colors.muted, fontSize: typography.sm, marginTop: 2 },
  balance: { fontSize: typography.lg, fontWeight: "800", color: colors.success },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: typography.sm },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  emptyT: { color: colors.muted },
  label: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary,
  },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: typography.sm },
  typeCard: { flex: 1, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  typeCardActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  typeT: { fontWeight: "800", color: colors.onSurface, fontSize: typography.lg },
  typeL: { color: colors.muted, fontSize: typography.sm, marginTop: 2 },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: typography.lg },
});
