import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

function fmt(n: number) { return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 }); }
function d(s: string) { try { return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return ""; } }

export default function MemberDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => { try { setData(await api.getMember(id as string)); } catch {} finally { setLoading(false); } })();
  }, [id]));

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Member" />
      <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
    </View>
  );
  if (!data) return null;

  const m = data.member;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title={m.name} subtitle={m.member_no} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "800", fontSize: 22 }}>
              {m.name.split(" ").map((s: string) => s[0]).slice(0, 2).join("")}
            </Text>
          </View>
          <Text style={styles.bigName}>{m.name}</Text>
          <Text style={styles.muted}>Joined {d(m.joined_on)}</Text>
          <View style={[styles.statusPill, { backgroundColor: m.status === "Active" ? colors.brandTertiary : "#FDECEA" }]}>
            <Text style={{ color: m.status === "Active" ? colors.brandPrimary : colors.error, fontWeight: "700" }}>{m.status}</Text>
          </View>
        </View>

        <Section title="Share capital & contact">
          <Row k="Share capital" v={fmt(m.share_capital)} />
          <Row k="Phone" v={m.phone} />
          <Row k="Address" v={m.address} />
          <Row k="Village / Town" v={m.village || "—"} />
          <Row k="District" v={m.district} />
          <Row k="Occupation" v={m.occupation || "—"} />
        </Section>

        <Section title="Nominee">
          <Row k="Name" v={m.nominee_name || "—"} />
          <Row k="Relation" v={m.nominee_relation || "—"} />
        </Section>

        <Section title={`Accounts (${data.accounts.length})`}>
          {data.accounts.length === 0 ? <Text style={styles.muted}>No deposit accounts.</Text> :
            data.accounts.map((a: any) => (
              <View key={a.id} style={styles.miniRow}>
                <View style={[styles.typePill, { backgroundColor: colors.brandTertiary }]}>
                  <Text style={{ color: colors.brandPrimary, fontWeight: "700", fontSize: 11 }}>{a.account_type}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{a.account_no}</Text>
                  <Text style={styles.muted}>{a.interest_rate}% • {a.tenure_months} mo</Text>
                </View>
                <Text style={{ color: colors.success, fontWeight: "800" }}>{fmt(a.balance)}</Text>
              </View>
            ))
          }
        </Section>

        <Section title={`Loans (${data.loans.length})`}>
          {data.loans.length === 0 ? <Text style={styles.muted}>No loans.</Text> :
            data.loans.map((l: any) => (
              <View key={l.id} style={styles.miniRow}>
                <Ionicons name="document-text" size={22} color={colors.brandPrimary} />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{l.loan_no}</Text>
                  <Text style={styles.muted}>{fmt(l.amount)} • {l.status}</Text>
                </View>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>EMI {fmt(l.emi)}</Text>
              </View>
            ))
          }
        </Section>

        <Section title="Recent activity">
          {data.transactions.length === 0 ? <Text style={styles.muted}>No activity.</Text> :
            data.transactions.map((t: any) => (
              <View key={t.id} style={styles.miniRow}>
                <Ionicons
                  name={t.type === "Deposit" || t.type === "ShareCapital" ? "arrow-down-circle" : "arrow-up-circle"}
                  size={22} color={t.type === "Deposit" || t.type === "ShareCapital" ? colors.success : colors.warning}
                />
                <View style={{ flex: 1, marginLeft: spacing.sm }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{t.type}</Text>
                  <Text style={styles.muted}>{t.receipt_no} • {d(t.created_at)}</Text>
                </View>
                <Text style={{ fontWeight: "800", color: t.type === "Deposit" || t.type === "ShareCapital" ? colors.success : colors.warning }}>
                  {fmt(t.amount)}
                </Text>
              </View>
            ))
          }
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={styles.sectionT}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={styles.muted}>{k}</Text>
      <Text style={{ color: colors.onSurface, fontWeight: "600", maxWidth: "60%", textAlign: "right" }}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: { alignItems: "center", padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, ...shadow.card },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  bigName: { fontSize: typography.xl, fontWeight: "700", marginTop: spacing.sm, color: colors.onSurface },
  muted: { color: colors.muted },
  statusPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, marginTop: spacing.sm },
  sectionT: { fontWeight: "700", fontSize: typography.lg, color: colors.onSurface, marginBottom: spacing.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, ...shadow.card },
  miniRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  typePill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
});
