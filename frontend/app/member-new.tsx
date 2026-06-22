import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography } from "@/src/lib/theme";

export default function MemberNew() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", phone: "", address: "", village: "", district: "Kamrup",
    aadhaar: "", pan: "", nominee_name: "", nominee_relation: "",
    occupation: "", share_capital: "100",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function up(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name || !form.phone || !form.address) { setErr("Name, phone & address are required."); return; }
    setErr(null); setBusy(true);
    try {
      await api.addMember({ ...form, share_capital: parseFloat(form.share_capital) || 100 });
      router.back();
    } catch (e: any) { setErr(e?.message ?? "Failed"); } finally { setBusy(false); }
  }

  const FIELDS: { k: string; l: string; ph?: string; keyboard?: any }[] = [
    { k: "name", l: "Full name *", ph: "Rahim Ali" },
    { k: "phone", l: "Phone *", ph: "+91-98xxxxxxxx", keyboard: "phone-pad" },
    { k: "address", l: "Address *", ph: "House no, street" },
    { k: "village", l: "Village / Town", ph: "Sualkuchi" },
    { k: "district", l: "District", ph: "Kamrup" },
    { k: "occupation", l: "Occupation", ph: "Weaver / Farmer / Trader" },
    { k: "aadhaar", l: "Aadhaar (optional)", keyboard: "number-pad" },
    { k: "pan", l: "PAN (optional)" },
    { k: "nominee_name", l: "Nominee name" },
    { k: "nominee_relation", l: "Nominee relation", ph: "Spouse / Son" },
    { k: "share_capital", l: "Share capital ₹ (min 100)", keyboard: "decimal-pad" },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScreenHeader title="New Member" subtitle="Per Assam Co-op Act, 2007 — Sec. 33" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {FIELDS.map((f) => (
          <View key={f.k} style={{ marginBottom: spacing.md }}>
            <Text style={styles.label}>{f.l}</Text>
            <TextInput
              testID={`member-${f.k}`}
              style={styles.input}
              placeholder={f.ph}
              placeholderTextColor={colors.muted}
              value={(form as any)[f.k]}
              onChangeText={(v) => up(f.k, v)}
              keyboardType={f.keyboard ?? "default"}
            />
          </View>
        ))}
        {err && <Text style={styles.err}>{err}</Text>}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable testID="save-member" style={styles.cta} disabled={busy} onPress={submit}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Save Member</Text>}
        </Pressable>
      </View>
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
  err: { color: colors.error, marginTop: spacing.sm, fontSize: typography.base },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surfaceSecondary },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: typography.lg, fontWeight: "700" },
});
