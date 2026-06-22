import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

function emi(p: number, r: number, n: number) {
  const m = r / 12 / 100;
  if (!p || !n) return 0;
  if (m === 0) return p / n;
  return (p * m * Math.pow(1 + m, n)) / (Math.pow(1 + m, n) - 1);
}

export default function LoanNew() {
  const router = useRouter();
  const [members, setMembers] = useState<any[]>([]);
  const [memberId, setMemberId] = useState("");
  const [amount, setAmount] = useState("50000");
  const [rate, setRate] = useState("12");
  const [tenure, setTenure] = useState("12");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { (async () => {
    try { const ms = await api.listMembers(); setMembers(ms); if (ms[0]) setMemberId(ms[0].id); } catch {}
  })(); }, []);

  const e = emi(parseFloat(amount), parseFloat(rate), parseInt(tenure || "0", 10));
  const total = e * (parseInt(tenure || "0", 10) || 0);
  const interest = total - (parseFloat(amount) || 0);

  const submit = useCallback(async () => {
    if (!memberId || !purpose) { setErr("Member and purpose are required."); return; }
    setErr(null); setBusy(true);
    try {
      await api.applyLoan({
        member_id: memberId, amount: parseFloat(amount), interest_rate: parseFloat(rate),
        tenure_months: parseInt(tenure, 10), purpose,
      });
      router.back();
    } catch (ex: any) { setErr(ex?.message ?? "Failed"); } finally { setBusy(false); }
  }, [memberId, amount, rate, tenure, purpose, router]);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Loan Application" subtitle="Members only (Sec. 47, Assam Co-op Act)" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <Text style={styles.label}>Member</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          {members.length === 0 && <Text style={{ color: colors.muted }}>Add a member first.</Text>}
          {members.map((m) => (
            <Pressable key={m.id} testID={`pick-member-${m.id}`}
              onPress={() => setMemberId(m.id)}
              style={[styles.chip, memberId === m.id && styles.chipActive]}>
              <Text style={[styles.chipText, memberId === m.id && { color: "#fff" }]}>{m.name}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.label}>Loan amount (₹)</Text>
        <TextInput testID="loan-amount" style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />

        <Text style={styles.label}>Interest rate (% p.a.)</Text>
        <TextInput testID="loan-rate" style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" />

        <Text style={styles.label}>Tenure (months)</Text>
        <TextInput testID="loan-tenure" style={styles.input} value={tenure} onChangeText={setTenure} keyboardType="number-pad" />

        <Text style={styles.label}>Purpose</Text>
        <TextInput testID="loan-purpose" style={styles.input} value={purpose} onChangeText={setPurpose}
          placeholder="Working capital, education, agriculture…" placeholderTextColor={colors.muted} />

        <View style={styles.emiCard}>
          <Text style={styles.emiTitle}>EMI estimate</Text>
          <Row k="Monthly EMI" v={`₹${e.toFixed(0)}`} strong />
          <Row k="Total interest" v={`₹${interest.toFixed(0)}`} />
          <Row k="Total payable" v={`₹${total.toFixed(0)}`} />
        </View>

        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable testID="submit-loan" style={styles.cta} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Submit Application</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Text style={{ color: colors.onSurfaceTertiary }}>{k}</Text>
      <Text style={{ color: colors.onSurface, fontWeight: strong ? "800" : "600", fontSize: strong ? typography.xl : typography.base }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary,
  },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: typography.sm },
  emiCard: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, ...shadow.card },
  emiTitle: { fontWeight: "700", color: colors.brandPrimary, fontSize: typography.base, marginBottom: spacing.sm },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: typography.lg, fontWeight: "700" },
});
