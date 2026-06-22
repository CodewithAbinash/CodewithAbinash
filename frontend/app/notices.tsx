import { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/auth";
import { colors, radius, spacing, typography, shadow } from "@/src/lib/theme";

const CATS = ["General", "AGM", "Circular", "Rule"] as const;

export default function Notices() {
  const { user } = useAuth();
  const canPost = user?.role === "Admin" || user?.role === "Manager";
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState(""); const [body, setBody] = useState(""); const [cat, setCat] = useState<typeof CATS[number]>("General");

  const load = useCallback(async () => {
    try { setItems(await api.listNotices()); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post() {
    if (!title || !body) return;
    setBusy(true);
    try { await api.addNotice({ title, body, category: cat }); setTitle(""); setBody(""); setOpen(false); load(); }
    catch {} finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Notices & AGM" subtitle="Circulars and meeting announcements" />
      {loading ? <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: spacing.xl }} /> : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="megaphone-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted }}>No notices yet.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`notice-${item.id}`}>
              <View style={[styles.catPill, { backgroundColor: item.category === "AGM" ? "#FFF3E0" : colors.brandTertiary }]}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: item.category === "AGM" ? colors.warning : colors.brandPrimary }}>{item.category}</Text>
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} • {item.created_by}
              </Text>
            </View>
          )}
        />
      )}

      {canPost && (
        <Pressable testID="add-notice-fab" style={styles.fab} onPress={() => setOpen(true)}>
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      )}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={styles.modalBack} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalCard} testID="notice-modal">
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.modalTitle}>New Notice</Text>
              <Pressable testID="close-notice-modal" onPress={() => setOpen(false)} style={{ marginLeft: "auto" }}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <Text style={styles.label}>Category</Text>
            <View style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}>
              {CATS.map((c) => (
                <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                  <Text style={[styles.chipT, cat === c && { color: "#fff" }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Title</Text>
            <TextInput testID="notice-title" style={styles.input} value={title} onChangeText={setTitle} />
            <Text style={styles.label}>Body</Text>
            <TextInput testID="notice-body" style={[styles.input, { height: 100, textAlignVertical: "top" }]}
              multiline value={body} onChangeText={setBody} />
            <Pressable testID="post-notice" style={[styles.cta, { marginTop: spacing.lg }]} disabled={busy} onPress={post}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaT}>Publish</Text>}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surfaceSecondary, padding: spacing.md, borderRadius: radius.md, ...shadow.card },
  catPill: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.sm },
  title: { fontWeight: "700", fontSize: typography.lg, color: colors.onSurface, marginTop: spacing.sm },
  body: { color: colors.onSurfaceTertiary, fontSize: typography.base, marginTop: spacing.xs, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: typography.sm, marginTop: spacing.sm },
  empty: { alignItems: "center", padding: spacing.xxxl, gap: spacing.md },
  fab: { position: "absolute", right: spacing.lg, bottom: spacing.xl, width: 56, height: 56, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", ...shadow.card, elevation: 4 },
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  modalTitle: { fontWeight: "700", color: colors.onSurface, fontSize: typography.xl },
  label: { fontSize: typography.sm, color: colors.onSurfaceTertiary, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: typography.lg, color: colors.onSurface, backgroundColor: colors.surfaceSecondary },
  chip: { paddingHorizontal: spacing.md, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipT: { color: colors.onSurfaceTertiary, fontWeight: "600", fontSize: typography.sm },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: "center" },
  ctaT: { color: "#fff", fontWeight: "700", fontSize: typography.lg },
});
