import { View, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useAuthStore } from '../../stores/auth';
import { useRouter } from 'expo-router';
import { colors, spacing, radius } from '../../config/colors';
import { useExecutiveDashboard } from '../../hooks/queries';
import { useState, useCallback } from 'react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function KpiCard({ label, value, helper, color }: { label: string; value: string | number; helper: string; color?: string }) {
  return (
    <View style={[styles.kpiCard, { borderLeftColor: color || colors.primary }]}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiHelper}>{helper}</Text>
    </View>
  );
}

function AlertItem({ text }: { text: string }) {
  return (
    <View style={styles.alertCard}>
      <Text style={styles.alertText}>{text}</Text>
    </View>
  );
}

function MunicipalityItem({ name, state, stage, revenue, probability }: { name: string; state: string; stage: string; revenue: number; probability: number }) {
  const stageLabels: Record<string, string> = {
    mapping: 'Mapeamento', first_contact: '1o contato', negotiation: 'Negociacao',
    implementation: 'Implantacao', fidelized: 'Fidelizado', paused: 'Pausado', lost: 'Perdido',
  };
  return (
    <View style={styles.municipalityItem}>
      <View style={styles.municipalityHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.municipalityName}>{name}/{state}</Text>
          <Text style={styles.municipalityStage}>{stageLabels[stage] || stage} · {(probability * 100).toFixed(0)}%</Text>
        </View>
        <Text style={styles.municipalityRevenue}>{formatCompact(revenue)}</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${Math.max(8, probability * 100)}%` }]} />
      </View>
    </View>
  );
}

export default function Dashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const year = new Date().getFullYear();
  const { data, isLoading, refetch } = useExecutiveDashboard();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleLogout = async () => {
    const { logout } = useAuthStore.getState();
    await logout();
    router.replace('/auth/login');
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Carregando dashboard...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Nao foi possivel carregar os dados.</Text>
        <Text style={styles.retryText} onPress={() => refetch()}>Tentar novamente</Text>
        <Text style={[styles.logoutButton, { color: colors.statusError }]} onPress={handleLogout}>Sair do Sistema</Text>
      </View>
    );
  }

  const projectedGrossRevenue = data.municipalities.reduce((s, m) => s + m.estimatedAnnualRevenue * m.probability, 0);
  const weightedProfit = data.municipalities.reduce((s, m) => s + m.estimatedAnnualProfit * m.probability, 0);
  const projectedMargin = projectedGrossRevenue > 0 ? weightedProfit / projectedGrossRevenue : 0;
  const implementationCoverage = data.kpis.citiesWorked > 0 ? (data.kpis.citiesInImplementation + data.kpis.citiesFidelized) / data.kpis.citiesWorked : 0;

  const municipalityRanking = [...data.municipalities]
    .sort((a, b) => b.estimatedAnnualRevenue * b.probability - a.estimatedAnnualRevenue * a.probability)
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.greeting}>Ola, {user?.name?.split(' ')[0] || 'Usuario'}</Text>
        <Text style={styles.greetingSub}>Dashboard executivo · {year}</Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Faturamento bruto projetado</Text>
        <Text style={styles.heroValue}>{formatCurrency(projectedGrossRevenue)}</Text>
        <Text style={styles.heroSub}>Projecao ponderada considerando pipeline e probabilidades</Text>

        <View style={styles.heroMetrics}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{formatCompact(weightedProfit)}</Text>
            <Text style={styles.heroMetricLabel}>Lucro projetado</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{(projectedMargin * 100).toFixed(1)}%</Text>
            <Text style={styles.heroMetricLabel}>Margem</Text>
          </View>
          <View style={styles.heroMetricDivider} />
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricValue}>{(implementationCoverage * 100).toFixed(0)}%</Text>
            <Text style={styles.heroMetricLabel}>Cobertura</Text>
          </View>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <KpiCard label="Cidades trabalhadas" value={data.kpis.citiesWorked} helper={`municipios em ${year}`} color={colors.statusInfo} />
        <KpiCard label="Cidades fidelizadas" value={data.kpis.citiesFidelized} helper="base recorrente" color={colors.statusActive} />
        <KpiCard label="Lucro base YTD" value={formatCompact(data.kpis.profitBaseYtd)} helper="resultado operacional" color={colors.statusWarning} />
        <KpiCard label="Comissao prevista" value={formatCompact(data.kpis.commissionForecastYtd)} helper="acumulo no ano" color={colors.statusPurple} />
      </View>

      {data.alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radar executivo</Text>
          {data.alerts.map((alert) => (
            <AlertItem key={alert} text={alert} />
          ))}
        </View>
      )}

      {municipalityRanking.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cidades com maior projecao</Text>
          {municipalityRanking.map((m) => (
            <MunicipalityItem key={m.id} name={m.municipalityName} state={m.state} stage={m.stage} revenue={m.estimatedAnnualRevenue * m.probability} probability={m.probability} />
          ))}
        </View>
      )}

      <Text style={[styles.logoutButton, { color: colors.statusError }]} onPress={handleLogout}>Sair do Sistema</Text>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  contentContainer: { paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  loadingContainer: { flex: 1, backgroundColor: colors.bgPrimary, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: colors.textSecondary, fontSize: 14 },
  errorText: { color: colors.statusError, fontSize: 16, marginBottom: 8 },
  retryText: { color: colors.primary, fontSize: 14, textDecorationLine: 'underline', marginBottom: 20 },
  header: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  greeting: { fontSize: 22, fontWeight: '600', color: colors.textPrimary },
  greetingSub: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  heroCard: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.xl, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.lg },
  heroLabel: { fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 2, marginBottom: spacing.sm },
  heroValue: { fontSize: 32, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  heroSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.xl },
  heroMetrics: { flexDirection: 'row', alignItems: 'center' },
  heroMetric: { flex: 1 },
  heroMetricValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  heroMetricLabel: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  heroMetricDivider: { width: 1, height: 32, backgroundColor: colors.borderSubtle },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  kpiCard: { flex: 1, minWidth: '45%', backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, borderLeftWidth: 3 },
  kpiLabel: { fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: spacing.sm },
  kpiValue: { fontSize: 22, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  kpiHelper: { fontSize: 11, color: colors.textSecondary },
  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  alertCard: { backgroundColor: `${colors.statusWarning}15`, borderLeftWidth: 3, borderLeftColor: colors.statusWarning, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  alertText: { color: '#fde68a', fontSize: 13, lineHeight: 20 },
  municipalityItem: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.sm },
  municipalityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  municipalityName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  municipalityStage: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  municipalityRevenue: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  progressBarBg: { height: 4, borderRadius: 2, backgroundColor: colors.bgSurface, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2, backgroundColor: colors.accentHover },
  logoutButton: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginTop: spacing.xl, paddingVertical: spacing.md },
});
