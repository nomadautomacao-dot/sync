import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { colors, spacing, radius } from '../../config/colors';
import { moduleCatalog } from '../../types';
import { useRouter } from 'expo-router';

function ModuleCard({ module, onPress }: { module: typeof moduleCatalog[0]; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress}>
      <View style={[styles.card, { borderLeftColor: module.color, borderLeftWidth: 3 }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconContainer, { backgroundColor: `${module.color}20` }]}>
            <Text style={[styles.iconDot, { color: module.color }]}>{module.label.charAt(0)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{module.label}</Text>
            <Text style={styles.cardDesc}>{module.description}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ModulesScreen() {
  const router = useRouter();

  const handleModulePress = (key: string) => {
    if (key === 'levantamento-fundeb') {
      router.push('/(drawer)/fundeb');
    } else {
      // Outros módulos ainda não implementados
      console.log('Modulo nao implementado:', key);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{moduleCatalog.length} modulos disponiveis</Text>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {moduleCatalog.map(mod => (
          <ModuleCard key={mod.key} module={mod} onPress={() => handleModulePress(mod.key)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary, paddingHorizontal: spacing.base },
  header: { paddingTop: spacing.md, paddingBottom: spacing.md },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  list: { flex: 1 },
  card: { backgroundColor: colors.bgElevated, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.borderSubtle, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconContainer: { width: 44, height: 44, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  iconDot: { fontSize: 20, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  cardDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
});
