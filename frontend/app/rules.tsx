import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Rules() {
  const [data, setData] = useState<any>(null);

  useEffect(() => { (async () => { try { setData(await api.rules()); } catch {} })(); }, []);

  if (!data) return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Assam Co-op Rules" />
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Assam Co-op Rules" subtitle={data.act} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
        <View style={styles.card}>
          <Row icon="business" k="Registrar" v={data.registrar} />
          <Row icon="people" k="Min. members to register" v={String(data.min_members_to_register)} />
          <Row icon="wallet" k="Min. share capital / member" v={`₹${data.min_share_capital_per_member}`} />
          <Row icon="pie-chart" k="Max. dividend payable" v={`${data.max_dividend_pct}%`} />
          <Row icon="shield" k="Reserve fund (of profit)" v={`${data.reserve_fund_min_pct_of_profit}%`} />
          <Row icon="calendar" k="AGM within (FY end)" v={`${data.agm_within_days_of_fy_end} days`} />
          <Row icon="clipboard" k="Annual audit" v={data.audit} />
          <Row icon="trending-up" k="Interest cap" v={`${data.interest_cap_pa}% p.a.`} />
        </View>

        <Text style={styles.section}>Key sections</Text>
        <View style={styles.card}>
          {Object.entries(data.key_sections as Record<string, string>).map(([k, v]) => (
            <View key={k} style={styles.sectionRow}>
              <Text style={styles.secK}>{k}</Text>
              <Text style={styles.secV}>{v}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.section}>Loan priority</Text>
        <View style={styles.card}>
          {(data.loan_priority as string[]).map((p, i) => (
            <View key={i} style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.brandPrimary} />
              <Text style={{ flex: 1, color: colors.onSurface }}>{p}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.dis}>{data.disclaimer}</Text>
      </ScrollView>
    </View>
  );
}

function Row({ icon, k, v }: { icon: any; k: string; v: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconC}><Ionicons name={icon} size={18} color={colors.brandPrimary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.k}>{k}</Text>
        <Text style={styles.v}>{v}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, ...shadow.card, gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.xs },
  iconC: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  k: { fontSize: typography.sm, color: colors.muted },
  v: { fontSize: typography.base, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  section: { fontSize: typography.lg, fontWeight: "700", marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.onSurface },
  sectionRow: { flexDirection: "row", gap: spacing.md, paddingVertical: spacing.xs },
  secK: { fontWeight: "700", color: colors.brandPrimary, minWidth: 70 },
  secV: { flex: 1, color: colors.onSurface },
  dis: { color: colors.muted, fontSize: typography.sm, marginTop: spacing.lg, fontStyle: "italic" },
});
