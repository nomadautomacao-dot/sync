import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, radius } from '../../config/colors';
import { useCompanies } from '../../hooks/queries';
import { useState, useCallback } from 'react';
import type { Company } from '../../types';

function CompanyCard({ company }: { company: Company }) {
  const initial = (company.tradingName || company.name).charAt(0).toUpperCase();
  const statusColor: Record<string, string> = {
    active: colors.statusActive, inactive: colors.statusError, pending: colors.statusWarning,
  };
  return (
    <View style={styles.companyCard}>
      <View style={[styles.companyAvatar, { backgroundColor: company.color || colors.primary }]}>
        <Text style={styles.companyAvatarText}>{initial}</Text>
      </View>
      <View style={styles.companyInfo}>
        <Text style={styles.companyName}>{company.tradingName || company.name}</Text>
        <Text style={styles.companyCity}>{company.city}/{company.state}</Text>
        <Text style={styles.companySegment}>{company.segment || company.email}</Text>
      </View>
      <View style={[styles.statusDot, { backgroundColor: statusColor[company.status] || colors.textTertiary }]} />
    </View>
  );
}

export default function CompaniesScreen() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string | undefined>();
  const { data: companies = [], isLoading, refetch } = useCompanies(search, status);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const activeCount = companies.filter(c => c.status === 'active').length;
  const total = companies.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{total} empresas · {activeCount} ativas</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar empresa..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filters}>
        {[
          { key: undefined, label: 'Todas' },
          { key: 'active', label: 'Ativas' },
          { key: 'inactive', label: 'Inativas' },
        ].map(f => (
          <TouchableOpacity key={f.label || 'all'} onPress={() => setStatus(f.key)} style={[styles.filterChip, status === f.key && styles.filterChipActive]}>
            <Text style={[styles.filterChipText, status === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isLoading ? (
          <Text style={styles.emptyText}>Carregando...</Text>
        ) : companies.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma empresa encontrada</Text>
        ) : (
          companies.map(company => <CompanyCard key={company.id} company={company} />)
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
  filters: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bgSurface, borderWidth: 1, borderColor: colors.borderSubtle },
  filterChipActive: { backgroundColor: `${colors.primary}20`, borderColor: colors.primary },
  filterChipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  filterChipTextActive: { color: colors.primary },
  list: { flex: 1 },
  companyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.sm, gap: spacing.md },
  companyAvatar: { width: 44, height: 44, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  companyAvatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  companyInfo: { flex: 1 },
  companyName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  companyCity: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  companySegment: { fontSize: 11, color: colors.textTertiary, marginTop: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  emptyText: { color: colors.textTertiary, textAlign: 'center', marginTop: 48, fontSize: 14 },
});
