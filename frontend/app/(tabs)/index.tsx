import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/lib/auth";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

function fmt(n: number) {
  return "₹" + (n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function dateStr(s: string) {
  try {
    return new Date(s).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short",
    });
  } catch {
    return "";
  }
}

const ACTIONS = [
  { key: "deposit", label: "Collect", icon: "cash" as const, href: "/deposits" },
  { key: "members", label: "Members", icon: "people" as const, href: "/(tabs)/members" },
  { key: "loan", label: "New Loan", icon: "document-text" as const, href: "/loan-new" },
  { key: "notices", label: "Notices", icon: "megaphone" as const, href: "/notices" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="dashboard-screen">
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxxl }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={colors.brandPrimary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Namaskar 🙏</Text>
            <Text style={styles.userName} testID="dashboard-user-name">{user?.name}</Text>
            <View style={styles.roleBadge}>
              <Ionicons name="shield-checkmark" size={12} color={colors.brandPrimary} />
              <Text style={styles.roleText}>{user?.role}</Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceCard} testID="balance-card">
          <Text style={styles.balanceLabel}>Total society deposits</Text>
          <Text style={styles.balanceValue}>{fmt(data?.total_deposits ?? 0)}</Text>
          <View style={styles.balanceRow}>
            <View style={styles.balanceCol}>
              <Text style={styles.miniLabel}>Loan outstanding</Text>
              <Text style={styles.miniValue}>{fmt(data?.loan_outstanding ?? 0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.balanceCol}>
              <Text style={styles.miniLabel}>Active members</Text>
              <Text style={styles.miniValue}>{data?.members ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsGrid}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              testID={`quick-action-${a.key}`}
              style={styles.actionCard}
              onPress={() => router.push(a.href as any)}
            >
              <View style={styles.actionIcon}>
                <Ionicons name={a.icon} size={22} color={colors.brandPrimary} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statN}>{data?.active_loans ?? 0}</Text>
            <Text style={styles.statL}>Active loans</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statN}>{data?.pending_loans ?? 0}</Text>
            <Text style={styles.statL}>Pending loans</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statN}>{data?.accounts ?? 0}</Text>
            <Text style={styles.statL}>Deposit accounts</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent transactions</Text>
          {(data?.recent_transactions ?? []).length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyText}>No recent transactions.</Text>
            </View>
          ) : (
            (data.recent_transactions as any[]).map((t) => (
              <View key={t.id} style={styles.txnRow} testID={`txn-${t.id}`}>
                <View style={styles.txnIcon}>
                  <Ionicons
                    name={
                      t.type === "Deposit" || t.type === "ShareCapital"
                        ? "arrow-down-circle"
                        : "arrow-up-circle"
                    }
                    size={26}
                    color={
                      t.type === "Deposit" || t.type === "ShareCapital"
                        ? colors.success
                        : colors.warning
                    }
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>{t.type}</Text>
                  <Text style={styles.txnSub}>
                    {t.receipt_no} • {dateStr(t.created_at)} • by {t.by_name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txnAmt,
                    {
                      color:
                        t.type === "Deposit" || t.type === "ShareCapital"
                          ? colors.success
                          : colors.warning,
                    },
                  ]}
                >
                  {fmt(t.amount)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  header: { flexDirection: "row", padding: spacing.lg, paddingBottom: spacing.md },
  hello: { fontSize: typography.base, color: colors.onSurfaceTertiary },
  userName: { fontSize: typography.xl, fontWeight: "700", color: colors.onSurface, marginTop: 2 },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.brandTertiary, alignSelf: "flex-start",
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.pill, marginTop: spacing.sm,
  },
  roleText: { fontSize: typography.sm, color: colors.brandPrimary, fontWeight: "600" },

  balanceCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg, padding: spacing.lg,
  },
  balanceLabel: { color: "rgba(255,255,255,0.85)", fontSize: typography.base },
  balanceValue: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: spacing.xs },
  balanceRow: { flexDirection: "row", marginTop: spacing.lg, alignItems: "center" },
  balanceCol: { flex: 1 },
  miniLabel: { color: "rgba(255,255,255,0.7)", fontSize: typography.sm },
  miniValue: { color: "#fff", fontSize: typography.lg, fontWeight: "700", marginTop: 2 },
  divider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.2)", marginHorizontal: spacing.lg },

  actionsGrid: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.md,
  },
  actionCard: {
    flexBasis: "47%", flexGrow: 1,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md,
    ...shadow.card,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center",
  },
  actionLabel: { fontSize: typography.base, fontWeight: "600", color: colors.onSurface },

  statsRow: {
    flexDirection: "row", padding: spacing.lg, gap: spacing.sm,
  },
  stat: {
    flex: 1, backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, alignItems: "center", ...shadow.card,
  },
  statN: { fontSize: typography.xl, fontWeight: "700", color: colors.brandPrimary },
  statL: { fontSize: 11, color: colors.onSurfaceTertiary, marginTop: 2, textAlign: "center" },

  section: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  sectionTitle: { fontSize: typography.lg, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.md },
  empty: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: typography.base },

  txnRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surfaceSecondary, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.sm, gap: spacing.md,
  },
  txnIcon: { width: 36 },
  txnTitle: { fontSize: typography.base, fontWeight: "600", color: colors.onSurface },
  txnSub: { fontSize: typography.sm, color: colors.muted, marginTop: 2 },
  txnAmt: { fontSize: typography.lg, fontWeight: "700" },
});
