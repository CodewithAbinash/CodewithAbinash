import { useCallback, useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function Settings() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setForm(await api.getSettings()); } catch {} finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function up(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true); setSavedMsg(null);
    try {
      await api.updateSettings({
        society_name: form.society_name,
        registration_no: form.registration_no,
        address: form.address,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        default_savings_rate: parseFloat(form.default_savings_rate) || 0,
        default_loan_rate: parseFloat(form.default_loan_rate) || 0,
        default_dividend_pct: parseFloat(form.default_dividend_pct) || 0,
      });
      setSavedMsg("Saved");
    } catch (e: any) { setSavedMsg(e?.message ?? "Save failed"); }
    finally { setBusy(false); }
  }

  if (loading || !form) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        <ScreenHeader title="Society Settings" />
        <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} />
      </View>
    );
  }

  const FIELDS: { k: string; l: string; ph?: string; keyboard?: any; numeric?: boolean }[] = [
    { k: "society_name", l: "Society name", ph: "ABC Co-op Credit Society" },
    { k: "registration_no", l: "Registration no.", ph: "ASM/COOP/2024/0001" },
    { k: "address", l: "Address", ph: "Branch / HQ address" },
    { k: "contact_phone", l: "Contact phone", ph: "+91-XXXXXXXXXX", keyboard: "phone-pad" },
    { k: "contact_email", l: "Contact email", ph: "office@society.in", keyboard: "email-address" },
    { k: "default_savings_rate", l: "Default savings rate (%)", numeric: true, keyboard: "decimal-pad" },
    { k: "default_loan_rate", l: "Default loan rate (%)", numeric: true, keyboard: "decimal-pad" },
    { k: "default_dividend_pct", l: "Annual dividend (%)", numeric: true, keyboard: "decimal-pad" },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="Society Settings" subtitle={isAdmin ? "Configure your society" : "Read-only"} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {FIELDS.map((f) => (
          <View key={f.k} style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{f.l}</Text>
            <TextInput
              testID={`setting-${f.k}`}
              style={[styles.input, !isAdmin && { opacity: 0.6 }]}
              editable={isAdmin}
              placeholder={f.ph}
              placeholderTextColor={colors.muted}
              value={String(form[f.k] ?? "")}
              onChangeText={(v) => up(f.k, v)}
              keyboardType={f.keyboard ?? "default"}
            />
          </View>
        ))}

        <View style={styles.note}>
          <Text style={styles.noteT}>Compliance reminder</Text>
          <Text style={styles.noteB}>
            Per the Assam Co-op Act 2007, max dividend is 20% and reserve fund must be ≥ 25% of net profit.
            AGM must be held within 180 days of FY end (Sec. 65 & 78).
          </Text>
        </View>

        {savedMsg && <Text style={{ marginTop: spacing.md, color: savedMsg === "Saved" ? colors.success : colors.error }}>
          {savedMsg}
        </Text>}
      </ScrollView>

      {isAdmin && (
        <View style={styles.footer}>
          <Pressable testID="save-settings" style={[styles.cta, busy && { opacity: 0.6 }]} disabled={busy} onPress={save}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaT}>Save Settings</Text>}
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontSize: typography.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary,
  },
  note: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary, marginTop: spacing.md, ...shadow.card },
  noteT: { fontWeight: "700", color: colors.brandPrimary, marginBottom: 4 },
  noteB: { color: colors.brandPrimary, fontSize: typography.sm, lineHeight: 18 },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaT: { color: "#fff", fontWeight: "700", fontSize: typography.lg },
});
