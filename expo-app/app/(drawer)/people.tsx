import { View, StyleSheet, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, radius } from '../../config/colors';
import { useCollaborators } from '../../hooks/queries';
import { useState, useCallback } from 'react';
import type { CollaboratorListItem } from '../../types';

function CollaboratorCard({ item }: { item: CollaboratorListItem }) {
  const initial = item.fullName.charAt(0).toUpperCase();
  const statusColor: Record<string, string> = {
    active: colors.statusActive, inactive: colors.statusError, pending: colors.statusWarning,
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.fullName}</Text>
          <Text style={styles.cardRole}>{item.primaryRole}{item.state ? ` · ${item.state}` : ''}</Text>
        </View>
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{item.metrics.municipalitiesCount}</Text>
          <Text style={styles.metricLabel}>Cidades</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{item.metrics.fidelizedCount}</Text>
          <Text style={styles.metricLabel}>Fidelizadas</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatCompact(item.metrics.profitYtd)}</Text>
          <Text style={styles.metricLabel}>Lucro YTD</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{item.defaultCommissionPercent}%</Text>
          <Text style={styles.metricLabel}>Comissao</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.collabType}>{item.collaboratorType}</Text>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor[item.partnershipStatus] || colors.textTertiary}20` }]}>
          <Text style={[styles.statusText, { color: statusColor[item.partnershipStatus] || colors.textTertiary }]}>{item.partnershipStatus}</Text>
        </View>
      </View>
    </View>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

export default function PeopleScreen() {
  const [search, setSearch] = useState('');
  const { data: collaborators = [], isLoading, refetch } = useCollaborators({ search });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{collaborators.length} colaboradores ativos</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar colaborador..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <Text style={styles.emptyText}>Carregando...</Text>
        ) : collaborators.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum colaborador encontrado</Text>
        ) : (
          collaborators.map(item => <CollaboratorCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: spacing.base },
  header: { paddingTop: spacing.md, paddingBottom: spacing.md },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  searchContainer: { marginBottom: spacing.md },
  searchInput: { backgroundColor: colors.bgSurface, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 14, borderWidth: 1, borderColor: colors.borderSubtle },
  list: { flex: 1 },
  card: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  cardRole: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  metric: { flex: 1, backgroundColor: colors.bgSurface, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, alignItems: 'center' },
  metricValue: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  metricLabel: { fontSize: 9, color: colors.textTertiary, marginTop: 2, textTransform: 'uppercase' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  collabType: { fontSize: 11, color: colors.textTertiary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  emptyText: { color: colors.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 14 },
});
