import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Text, Card, Button, Avatar, IconButton } from 'react-native-paper';
import { colors, spacing, radius } from '../../config/colors';
import { useState, useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMunicipalitiesSearch, useExecutiveDashboard } from '../../hooks/queries';
import localMunicipalities from '../../assets/data/municipalities.json';

export default function FundebLevantamentoScreen() {
  const [search, setSearch] = useState('');
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const { data: apiSuggestions = [], isLoading: isSearching } = useMunicipalitiesSearch(search);
  const { data: dashboardData } = useExecutiveDashboard();

  // Se a API não retornar nada e o usuário digitou algo, tenta buscar no arquivo local incluído no APK
  const suggestions = useMemo(() => {
    if (apiSuggestions.length > 0) return apiSuggestions;
    if (search.length > 2) {
      return (localMunicipalities.municipios as any[])
        .filter(m => m.nome.toLowerCase().includes(search.toLowerCase()))
        .map(m => ({ id: m.codigo_ibge, name: m.nome, state: m.uf }))
        .slice(0, 5);
    }
    return [];
  }, [apiSuggestions, search]);

  const handleSelectCity = (city: any) => {
    setSelectedCity(city);
    setSearch(`${city.name} (${city.state || city.uf})`);
    setShowSuggestions(false);
  };

  const recentMunicipalities = dashboardData?.municipalities || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.promoCard}>
          <MaterialCommunityIcons name="auto-fix" size={32} color="#fff" />
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTitle}>Diagnostico com Base Oficial</Text>
            <Text style={styles.promoSub}>Analise baseada nos dados do SIOPE, FNDE e Censo Escolar integrados no sistema.</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Novo Levantamento</Text>
        </View>

        <Card style={styles.actionCard}>
          <Card.Content>
            <Text style={styles.cardLabel}>Busque no Banco de Dados</Text>
            <View style={styles.searchBoxContainer}>
              <View style={styles.searchBox}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textTertiary} />
                <TextInput 
                  style={styles.searchInput}
                  placeholder="Ex: Serra Talhada"
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={(t) => {
                    setSearch(t);
                    setShowSuggestions(true);
                    if (selectedCity) setSelectedCity(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                {isSearching && <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />}
              </View>

              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.map((city: any, idx) => (
                    <TouchableOpacity 
                      key={city.id || idx} 
                      style={[styles.suggestionItem, idx === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => handleSelectCity(city)}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.textTertiary} />
                      <Text style={styles.suggestionText}>{city.name} - {city.state || city.uf}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <Button 
                mode="contained" 
                onPress={() => {}} 
                style={styles.mainButton}
                buttonColor={colors.primary}
                disabled={!selectedCity}
            >
              Exibir Levantamento Real
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Levantamentos em Carteira</Text>
        </View>

        {recentMunicipalities.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Nenhum municipio em carteira encontrado.</Text>
          </View>
        ) : (
          recentMunicipalities.slice(0, 10).map(m => (
            <TouchableOpacity key={m.id} style={styles.reportItem}>
              <View style={[styles.statusIndicator, { backgroundColor: m.probability > 0.5 ? colors.statusActive : colors.statusWarning }]} />
              <View style={styles.reportInfo}>
                <Text style={styles.reportCity}>{m.municipalityName}/{m.state}</Text>
                <Text style={styles.reportMeta}>Estagio: {m.stage}</Text>
              </View>
              <View style={styles.scoreContainer}>
                <Text style={styles.scoreValue}>{(m.probability * 100).toFixed(0)}%</Text>
                <Text style={styles.scoreLabel}>Confianca</Text>
              </View>
              <IconButton icon="chevron-right" size={20} iconColor={colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}

        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Base de Dados de Relatorios</Text>
          <Text style={styles.helpText}>Este modulo utiliza a base de dados sincronizada do FUNDEB para gerar indicadores precisos. Os dados sao atualizados conforme as publicacoes oficiais.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content: { padding: spacing.base, paddingBottom: spacing.xl },
  promoCard: { 
    backgroundColor: '#6366f1', 
    borderRadius: radius.xl, 
    padding: spacing.lg, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.md,
    marginBottom: spacing.lg,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  promoTextContainer: { flex: 1 },
  promoTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  promoSub: { color: 'rgba(255, 255, 255, 0.8)', fontSize: 12, marginTop: 4, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md, marginTop: spacing.md },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, textTransform: 'uppercase', letterSpacing: 1 },
  seeAll: { fontSize: 12, color: colors.primary, fontWeight: '500' },
  actionCard: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderSubtle, zIndex: 10 },
  cardLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  searchBoxContainer: { position: 'relative', marginBottom: spacing.md, zIndex: 50 },
  searchBox: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.bgSurface, 
    borderRadius: radius.lg, 
    paddingHorizontal: spacing.md, 
    borderWidth: 1, 
    borderColor: colors.borderSubtle,
  },
  searchInput: { flex: 1, height: 48, color: colors.textPrimary, fontSize: 14, marginLeft: 8 },
  suggestionsContainer: { 
    position: 'absolute', 
    top: 50, 
    left: 0, 
    right: 0, 
    backgroundColor: colors.bgElevated, 
    borderRadius: radius.lg, 
    borderWidth: 1, 
    borderColor: colors.borderSubtle,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 100,
  },
  suggestionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: spacing.md, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.borderSubtle,
    gap: spacing.sm 
  },
  suggestionText: { color: colors.textPrimary, fontSize: 14 },
  mainButton: { borderRadius: radius.lg, paddingVertical: 4 },
  reportItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: colors.bgElevated, 
    borderRadius: radius.lg, 
    padding: spacing.md, 
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  statusIndicator: { width: 4, height: 40, borderRadius: 2, marginRight: spacing.md },
  reportInfo: { flex: 1 },
  reportCity: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  reportMeta: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  scoreContainer: { alignItems: 'center', minWidth: 50 },
  scoreValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  scoreLabel: { fontSize: 10, color: colors.textTertiary, textTransform: 'uppercase' },
  emptyBox: { padding: spacing.xl, alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.borderSubtle },
  emptyText: { color: colors.textTertiary, fontSize: 13 },
  helpBox: { marginTop: spacing.xl, padding: spacing.md, backgroundColor: `${colors.statusInfo}10`, borderRadius: radius.lg, borderWidth: 1, borderColor: `${colors.statusInfo}20` },
  helpTitle: { fontSize: 14, fontWeight: '600', color: colors.statusInfo, marginBottom: 4 },
  helpText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
});
