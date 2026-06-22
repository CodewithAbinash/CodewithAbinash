import { useState } from "react";
import {
  View, Text, TextInput, StyleSheet, ScrollView, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

export default function MemberNew() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", phone: "", address: "", village: "", district: "Kamrup",
    aadhaar: "", pan: "", nominee_name: "", nominee_relation: "",
    occupation: "", share_capital: "100",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<any>(null);

  function up(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name || !form.phone || !form.address) { setErr("Name, phone & address are required."); return; }
    setErr(null); setBusy(true);
    try {
      const res = await api.addMember({ ...form, share_capital: parseFloat(form.share_capital) || 100 });
      setCreated(res);
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

      <Modal visible={!!created} transparent animationType="fade" onRequestClose={() => { setCreated(null); router.back(); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard} testID="member-created-modal">
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={styles.mTitle}>Member created</Text>
            <Text style={styles.mNo}>{created?.member_no}</Text>
            <View style={styles.credBox}>
              <Text style={styles.credLbl}>Member login email</Text>
              <Text style={styles.credVal} selectable>{created?.login_email}</Text>
              <Text style={[styles.credLbl, { marginTop: spacing.sm }]}>Default password</Text>
              <Text style={styles.credVal} selectable>{created?.default_password}</Text>
              <Text style={styles.hint}>Share these with the member. They can change the password after first login.</Text>
            </View>
            <Pressable testID="member-created-done" style={styles.cta}
              onPress={() => { setCreated(null); router.back(); }}>
              <Text style={styles.ctaText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center", marginTop: spacing.md },
  ctaText: { color: colors.onBrandPrimary, fontSize: typography.lg, fontWeight: "700" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modalCard: { backgroundColor: colors.surfaceSecondary, padding: spacing.xl, borderRadius: radius.lg, alignItems: "center", width: "100%", maxWidth: 400, ...shadow.card },
  mTitle: { fontSize: typography.xl, fontWeight: "700", color: colors.onSurface, marginTop: spacing.md },
  mNo: { color: colors.brandPrimary, fontWeight: "700", marginTop: 4 },
  credBox: { width: "100%", backgroundColor: colors.brandTertiary, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.lg },
  credLbl: { color: colors.brandPrimary, fontSize: typography.sm, fontWeight: "600" },
  credVal: { color: colors.onSurface, fontSize: typography.lg, fontWeight: "700", marginTop: 2 },
  hint: { color: colors.brandPrimary, fontSize: typography.sm, marginTop: spacing.sm, lineHeight: 18 },
});
