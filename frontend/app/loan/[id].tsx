import { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert,
} from "react-native";
import { useLocalSearchParams, useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}
function d(s: string) {
  try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }); }
  catch { return ""; }
}

export default function LoanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const canPay = user?.role === "Admin" || user?.role === "Manager" || user?.role === "Agent";

  const load = useCallback(async () => {
    try { setData(await api.loanSchedule(id as string)); } catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function payNext() {
    setPaying(true);
    try {
      const r: any = await api.payEmi(id as string);
      Alert.alert("EMI Paid", `Receipt: ${r.receipt_no}`);
      await load();
    } catch (e: any) { Alert.alert("Failed", e?.message ?? "Try again"); }
    finally { setPaying(false); }
  }

  if (loading || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader title="Loan Schedule" />
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  const schedule = data.schedule || [];
  const paidCount = schedule.filter((s: any) => s.status === "Paid").length;
  const overdueCount = schedule.filter((s: any) => s.status === "Overdue").length;
  const progress = schedule.length ? paidCount / schedule.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title={data.loan_no} subtitle="EMI schedule" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
        <View style={styles.summary} testID="loan-summary">
          <Text style={styles.summLabel}>Outstanding</Text>
          <Text style={styles.summValue}>{fmt(data.total_payable - data.paid)}</Text>
          <View style={styles.bar}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <View style={styles.row3}>
            <View><Text style={styles.k}>EMI</Text><Text style={styles.v}>{fmt(data.emi)}</Text></View>
            <View><Text style={styles.k}>Paid</Text><Text style={styles.v}>{paidCount}/{schedule.length}</Text></View>
            <View><Text style={styles.k}>Status</Text>
              <Text style={[styles.v, { color: data.npa ? colors.error : colors.success }]}>
                {data.npa ? "NPA" : (overdueCount ? "Overdue" : "Regular")}
              </Text>
            </View>
          </View>
        </View>

        {schedule.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: spacing.sm }}>
              EMI schedule is generated after approval.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
            {schedule.map((s: any) => (
              <View key={s.id} style={styles.row} testID={`emi-${s.installment_no}`}>
                <View style={[styles.dot, {
                  backgroundColor:
                    s.status === "Paid" ? colors.success :
                    s.status === "Overdue" ? colors.error : colors.brandSecondary,
                }]}>
                  <Text style={{ color: s.status === "Due" ? colors.brandPrimary : "#fff", fontWeight: "800" }}>
                    {s.installment_no}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rTitle}>Due {d(s.due_date)}</Text>
                  <Text style={styles.rSub}>
                    Principal {fmt(s.principal_component)} • Interest {fmt(s.interest_component)}
                  </Text>
                  {s.paid_on && (
                    <Text style={{ color: colors.success, fontSize: typography.sm, marginTop: 2 }}>
                      Paid {d(s.paid_on)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.rAmt, {
                  color: s.status === "Paid" ? colors.success
                       : s.status === "Overdue" ? colors.error : colors.onSurface,
                }]}>
                  {fmt(s.emi)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {canPay && schedule.some((s: any) => s.status !== "Paid") && (
        <View style={styles.footer}>
          <Pressable testID="pay-next-emi" style={[styles.cta, paying && { opacity: 0.6 }]}
            disabled={paying} onPress={() => router.canGoBack() && payNext()}>
            {paying ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.ctaT}>Pay Next EMI ({fmt(data.emi)})</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { backgroundColor: colors.brandPrimary, padding: spacing.lg, borderRadius: radius.lg, ...shadow.card },
  summLabel: { color: "rgba(255,255,255,0.85)", fontSize: typography.base },
  summValue: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 2 },
  bar: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.2)", marginTop: spacing.md, overflow: "hidden" },
  fill: { height: 6, backgroundColor: "#fff" },
  row3: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md },
  k: { color: "rgba(255,255,255,0.7)", fontSize: typography.sm },
  v: { color: "#fff", fontWeight: "700", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, gap: spacing.md, ...shadow.card },
  dot: { width: 36, height: 36, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  rTitle: { fontWeight: "700", color: colors.onSurface },
  rSub: { color: colors.muted, fontSize: typography.sm, marginTop: 2 },
  rAmt: { fontSize: typography.lg, fontWeight: "800" },
  empty: { alignItems: "center", padding: spacing.xxxl },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaT: { color: "#fff", fontWeight: "700", fontSize: typography.lg },
});
