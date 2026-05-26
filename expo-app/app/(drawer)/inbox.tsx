import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, radius } from '../../config/colors';
import { useAudit } from '../../hooks/queries';
import { useState, useCallback } from 'react';
import type { AuditLogEntry } from '../../types';

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function AuditItem({ entry }: { entry: AuditLogEntry }) {
  const actionLabels: Record<string, string> = {
    company_created: 'Empresa criada', company_updated: 'Empresa atualizada', company_deleted: 'Empresa removida',
    employee_added: 'Funcionario adicionado', employee_removed: 'Funcionario removido',
    module_enabled: 'Modulo ativado', module_disabled: 'Modulo desativado',
    collaborator_created: 'Colaborador criado', collaborator_updated: 'Colaborador atualizado',
  };
  const actionColors: Record<string, string> = {
    company_created: colors.statusActive, company_updated: colors.statusInfo, company_deleted: colors.statusError,
    employee_added: colors.statusActive, employee_removed: colors.statusWarning,
    module_enabled: colors.statusActive, module_disabled: colors.statusError,
  };
  return (
    <View style={styles.auditItem}>
      <View style={[styles.auditDot, { backgroundColor: actionColors[entry.action] || colors.primary }]} />
      <View style={styles.auditContent}>
        <Text style={styles.auditAction}>{actionLabels[entry.action] || entry.action}</Text>
        <Text style={styles.auditDate}>{formatDate(entry.createdAt)}</Text>
      </View>
    </View>
  );
}

export default function InboxScreen() {
  const { data: entries = [], isLoading, refetch } = useAudit(50);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{entries.length} registros recentes</Text>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <Text style={styles.emptyText}>Carregando...</Text>
        ) : entries.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma atividade registrada</Text>
        ) : (
          entries.map(entry => <AuditItem key={entry.id} entry={entry} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: spacing.base },
  header: { paddingTop: spacing.md, paddingBottom: spacing.md },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { flex: 1 },
  auditItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
  auditDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  auditContent: { flex: 1 },
  auditAction: { fontSize: 14, color: colors.textPrimary, fontWeight: '500' },
  auditDate: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  emptyText: { color: colors.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 14 },
});
