# 🎨 Passo 3: Componentes UI Base

## 📋 Objetivo

Portar e adaptar os componentes UI do projeto web para React Native, mantendo a fidelidade visual e funcional.

## 🎯 Estratégia de Migração

```
Web Component                    Mobile Component
├─ Button                      ├─ React Native Paper Button
├─ Input                       ├─ React Native Paper TextInput
├─ Card                        ├─ React Native Paper Card
├─ Dialog                      ├─ React Native Paper Portal/Modal
├─ Avatar                      ├─ React Native Paper Avatar
├─ Badge                       ├─ React Native Paper Badge
├─ Progress                    ├─ React Native Paper ProgressBar
├─ Table                       ├─ FlatList com custom header
├─ Select/Dropdown             ├─ React Native Paper Menu/Select
├─ Checkbox                    ├─ React Native Paper Checkbox
├─ Switch/Toggle               ├─ React Native Paper Switch
├─ Tabs                        ├─ React Native Paper TabBar
├─ Icons                       ├─ React Native Vector Icons
└─ Toast/Notification          ├─ React Native Paper Snackbar
```

## 🔧 Setup de Componentes Base

### 1. Button Component

### components/ui/button.tsx
```typescript
import React from 'react';
import { Button as RNPButton, useTheme } from 'react-native-paper';
import { StyleSheet, ViewStyle } from 'react-native';

interface ButtonProps {
  mode?: 'text' | 'outlined' | 'contained' | 'contained-tonal' | 'elevated';
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
}

export function Button({
  mode = 'contained',
  children,
  onPress,
  disabled,
  loading,
  icon,
  style,
  contentStyle,
  variant = 'primary',
}: ButtonProps) {
  const theme = useTheme();

  const getButtonColor = () => {
    switch (variant) {
      case 'primary':
        return theme.colors.primary;
      case 'secondary':
        return theme.colors.secondary;
      case 'danger':
        return theme.colors.error;
      case 'success':
        return '#22c55e';
      default:
        return theme.colors.primary;
    }
  };

  return (
    <RNPButton
      mode={mode}
      onPress={onPress}
      disabled={disabled}
      loading={loading}
      icon={icon}
      buttonColor={mode === 'contained' ? getButtonColor() : undefined}
      textColor={mode !== 'contained' ? getButtonColor() : undefined}
      style={[styles.button, style]}
      contentStyle={[styles.content, contentStyle]}
    >
      {children}
    </RNPButton>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  content: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});
```

### 2. Input Component

### components/ui/input.tsx
```typescript
import React from 'react';
import { TextInput as RNPTextInput, useTheme, HelperText } from 'react-native-paper';
import { StyleSheet, ViewStyle } from 'react-native';

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  mode?: 'flat' | 'outlined';
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: 'email' | 'password' | 'username' | 'name';
  error?: string;
  disabled?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  right?: React.ReactNode;
  left?: React.ReactNode;
  style?: ViewStyle;
  placeholder?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  mode = 'outlined',
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  error,
  disabled = false,
  multiline = false,
  numberOfLines = 1,
  right,
  left,
  style,
  placeholder,
}: InputProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <RNPTextInput
        label={label}
        value={value}
        onChangeText={onChangeText}
        mode={mode}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        disabled={disabled}
        multiline={multiline}
        numberOfLines={numberOfLines}
        right={right}
        left={left}
        placeholder={placeholder}
        error={!!error}
        style={styles.input}
        theme={{
          colors: {
            primary: theme.colors.primary,
            error: theme.colors.error,
          },
        }}
      />
      {error && (
        <HelperText type="error" visible={!!error}>
          {error}
        </HelperText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
  },
});
```

### 3. Card Component

### components/ui/card.tsx
```typescript
import React from 'react';
import { Card as RNPCard, Text, useTheme } from 'react-native-paper';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: ViewStyle;
  elevation?: number;
  variant?: 'elevated' | 'outlined' | 'contained';
}

export function Card({
  children,
  title,
  subtitle,
  onPress,
  style,
  elevation = 2,
  variant = 'elevated',
}: CardProps) {
  const theme = useTheme();

  const cardContent = (
    <>
      {(title || subtitle) && (
        <View style={styles.header}>
          {title && (
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text variant="bodyMedium" style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </>
  );

  if (onPress) {
    return (
      <RNPCard
        mode={variant}
        onPress={onPress}
        elevation={elevation}
        style={[styles.card, style]}
      >
        <RNPCard.Content>{cardContent}</RNPCard.Content>
      </RNPCard>
    );
  }

  return (
    <RNPCard
      mode={variant}
      elevation={elevation}
      style={[styles.card, style]}
    >
      <RNPCard.Content>{cardContent}</RNPCard.Content>
    </RNPCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    opacity: 0.7,
  },
  content: {
    gap: 8,
  },
});
```

### 4. Avatar Component

### components/ui/avatar.tsx
```typescript
import React from 'react';
import { Avatar as RNPAvatar, useTheme } from 'react-native-paper';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface AvatarProps {
  source?: { uri: string };
  label?: string;
  size?: number;
  style?: ViewStyle;
  variant?: 'image' | 'text' | 'icon';
  icon?: string;
}

export function Avatar({
  source,
  label,
  size = 40,
  style,
  variant = 'image',
  icon = 'person',
}: AvatarProps) {
  const theme = useTheme();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (variant === 'image' && source) {
    return (
      <RNPAvatar.Image
        source={source}
        size={size}
        style={[styles.avatar, style]}
      />
    );
  }

  if (variant === 'text' && label) {
    return (
      <RNPAvatar.Text
        label={getInitials(label)}
        size={size}
        style={[styles.avatar, style]}
        labelStyle={styles.avatarLabel}
      />
    );
  }

  return (
    <RNPAvatar.Icon
      size={size}
      icon={() => (
        <Ionicons
          name={icon as any}
          size={size * 0.6}
          color={theme.colors.onSurface}
        />
      )}
      style={[styles.avatar, style]}
    />
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#e0e7ff',
  },
  avatarLabel: {
    color: '#6366f1',
  },
});
```

### 5. Badge Component

### components/ui/badge.tsx
```typescript
import React from 'react';
import { Badge as RNPBadge, useTheme } from 'react-native-paper';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
}

export function Badge({
  children,
  variant = 'default',
  size = 'medium',
  style,
}: BadgeProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'success':
        return '#dcfce7';
      case 'warning':
        return '#fef3c7';
      case 'error':
        return '#fee2e2';
      case 'info':
        return '#dbeafe';
      default:
        return '#f3f4f6';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'success':
        return '#166534';
      case 'warning':
        return '#92400e';
      case 'error':
        return '#991b1b';
      case 'info':
        return '#1e40af';
      default:
        return '#374151';
    }
  };

  const getSize = () => {
    switch (size) {
      case 'small':
        return { padding: 2, paddingHorizontal: 6 };
      case 'large':
        return { padding: 6, paddingHorizontal: 12 };
      default:
        return { padding: 4, paddingHorizontal: 8 };
    }
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getBackgroundColor() },
        getSize(),
        style,
      ]}
    >
      <RNPBadge
        style={[styles.text, { color: getTextColor() }]}
      >
        {children}
      </RNPBadge>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});
```

### 6. Modal/Dialog Component

### components/ui/modal.tsx
```typescript
import React from 'react';
import { Modal as RNPModal, Portal, Text, Button, useTheme } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';

interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
  variant?: 'alert' | 'confirm' | 'info';
}

export function Modal({
  visible,
  onDismiss,
  title,
  children,
  actions,
  confirmText = 'Confirmar',
  onConfirm,
  cancelText = 'Cancelar',
  variant = 'info',
}: ModalProps) {
  const theme = useTheme();

  const handleConfirm = () => {
    onConfirm?.();
    onDismiss();
  };

  return (
    <Portal>
      <RNPModal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        {title && (
          <Text variant="titleLarge" style={styles.title}>
            {title}
          </Text>
        )}

        <View style={styles.content}>{children}</View>

        {actions ? (
          <View style={styles.actions}>{actions}</View>
        ) : (
          <View style={styles.defaultActions}>
            <Button mode="outlined" onPress={onDismiss} style={styles.button}>
              {cancelText}
            </Button>
            <Button
              mode="contained"
              onPress={handleConfirm}
              variant={variant === 'alert' ? 'danger' : 'primary'}
              style={styles.button}
            >
              {confirmText}
            </Button>
          </View>
        )}
      </RNPModal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 24,
  },
  title: {
    marginBottom: 16,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 20,
    gap: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  defaultActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  button: {
    minWidth: 100,
  },
});
```

### 7. Status Badge Component (para status)

### components/ui/status-badge.tsx
```typescript
import React from 'react';
import { Badge } from './badge';
import { View, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'draft' | 'archived' | 'error';
  label?: string;
  showIcon?: boolean;
}

export function StatusBadge({ status, label, showIcon = true }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          variant: 'success' as const,
          icon: 'checkmark-circle',
          defaultLabel: 'Ativo',
        };
      case 'inactive':
        return {
          variant: 'default' as const,
          icon: 'close-circle',
          defaultLabel: 'Inativo',
        };
      case 'pending':
        return {
          variant: 'warning' as const,
          icon: 'time',
          defaultLabel: 'Pendente',
        };
      case 'draft':
        return {
          variant: 'info' as const,
          icon: 'document-text',
          defaultLabel: 'Rascunho',
        };
      case 'archived':
        return {
          variant: 'default' as const,
          icon: 'archive',
          defaultLabel: 'Arquivado',
        };
      case 'error':
        return {
          variant: 'error' as const,
          icon: 'alert-circle',
          defaultLabel: 'Erro',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <View style={styles.container}>
      {showIcon && (
        <Ionicons
          name={config.icon as any}
          size={16}
          color={config.variant === 'success' ? '#22c55e' : config.variant === 'error' ? '#ef4444' : '#f59e0b'}
          style={styles.icon}
        />
      )}
      <Badge variant={config.variant}>
        {label || config.defaultLabel}
      </Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 16,
  },
});
```

### 8. Empty State Component

### components/ui/empty-state.tsx
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({
  icon = 'cube-outline',
  title,
  description,
  action,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Ionicons
        name={icon as any}
        size={64}
        color={theme.colors.primary}
        style={styles.icon}
      />
      <Text variant="titleMedium" style={styles.title}>
        {title}
      </Text>
      {description && (
        <Text variant="bodyMedium" style={styles.description}>
          {description}
        </Text>
      )}
      {action && (
        <Text style={styles.action} onPress={action.onPress}>
          {action.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  icon: {
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    textAlign: 'center',
    opacity: 0.7,
  },
  action: {
    color: '#6366f1',
    fontWeight: '600',
    marginTop: 8,
  },
});
```

## 📊 Componentes de Display de Dados

### 9. List Item Component

### components/data-display/list-item.tsx
```typescript
import React from 'react';
import { List, useTheme } from 'react-native-paper';
import { StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ListItemProps {
  title: string;
  description?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  icon?: string;
  badge?: {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'info';
  };
  disabled?: boolean;
}

export function ListItem({
  title,
  description,
  left,
  right,
  onPress,
  icon,
  badge,
  disabled = false,
}: ListItemProps) {
  const theme = useTheme();

  const LeftComponent = () => {
    if (left) return left;
    if (icon) {
      return (
        <List.Icon
          icon={() => (
            <Ionicons
              name={icon as any}
              size={24}
              color={disabled ? theme.colors.onSurfaceDisabled : theme.colors.primary}
            />
          )}
        />
      );
    }
    return null;
  };

  const RightComponent = () => {
    if (badge) {
      return (
        <View style={styles.badgeContainer}>
          <Badge
            variant={badge.variant || 'default'}
            size="small"
          >
            {badge.text}
          </Badge>
        </View>
      );
    }
    return right;
  };

  return (
    <List.Item
      title={title}
      description={description}
      left={LeftComponent}
      right={RightComponent}
      onPress={onPress}
      disabled={disabled}
      style={styles.item}
      titleStyle={disabled ? styles.disabledText : undefined}
      descriptionStyle={disabled ? styles.disabledText : undefined}
    />
  );
}

const styles = StyleSheet.create({
  item: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  badgeContainer: {
    marginRight: 8,
  },
  disabledText: {
    opacity: 0.5,
  },
});
```

### 10. Progress Bar Component

### components/data-display/progress-bar.tsx
```typescript
import React from 'react';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { View, StyleSheet } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
  showPercentage?: boolean;
  color?: string;
  height?: number;
}

export function ProgressBar({
  progress,
  label,
  showPercentage = false,
  color,
  height = 8,
}: ProgressBarProps) {
  const theme = useTheme();

  const getColor = () => {
    if (color) return color;
    if (progress >= 0.7) return '#22c55e';
    if (progress >= 0.4) return '#f59e0b';
    return '#ef4444';
  };

  const getLabelText = () => {
    if (label) return label;
    return `Progresso: ${Math.round(progress * 100)}%`;
  };

  return (
    <View style={styles.container}>
      {(label || showPercentage) && (
        <View style={styles.labelRow}>
          <Text variant="bodySmall" style={styles.label}>
            {getLabelText()}
          </Text>
          {showPercentage && (
            <Text variant="bodySmall" style={styles.percentage}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </View>
      )}
      <ProgressBar
        progress={progress}
        color={getColor()}
        style={[styles.bar, { height }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    opacity: 0.7,
  },
  percentage: {
    fontWeight: '600',
  },
  bar: {
    borderRadius: 4,
  },
});
```

## 🧪 Testando Componentes

### Test Screen

### app/test-components.tsx
```typescript
import { ScrollView, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Avatar } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { StatusBadge } from '../components/ui/status-badge';
import { EmptyState } from '../components/ui/empty-state';
import { ListItem } from '../components/data-display/list-item';
import { ProgressBar } from '../components/data-display/progress-bar';
import { Modal } from '../components/ui/modal';
import { useState } from 'react';

export default function TestComponentsScreen() {
  const [showModal, setShowModal] = useState(false);
  const [inputValue, setInputValue] = useState('');

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineMedium" style={styles.header}>
        Teste de Componentes
      </Text>

      <Card title="Buttons">
        <View style={styles.buttonRow}>
          <Button>Primary</Button>
          <Button mode="outlined">Outlined</Button>
          <Button mode="text">Text</Button>
        </View>
      </Card>

      <Card title="Inputs">
        <Input
          label="Email"
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Digite seu email"
        />
        <Input
          label="Senha"
          value=""
          onChangeText={() => {}}
          secureTextEntry
        />
      </Card>

      <Card title="Avatars">
        <View style={styles.avatarRow}>
          <Avatar source={{ uri: 'https://i.pravatar.cc/150' }} />
          <Avatar label="João Silva" />
          <Avatar icon="person" />
        </View>
      </Card>

      <Card title="Badges">
        <View style={styles.badgeRow}>
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="error">Error</Badge>
        </View>
      </Card>

      <Card title="Status Badges">
        <View style={styles.statusRow}>
          <StatusBadge status="active" />
          <StatusBadge status="pending" />
          <StatusBadge status="error" />
        </View>
      </Card>

      <Card title="List Items">
        <ListItem
          title="Item 1"
          description="Descrição do item 1"
          icon="home"
          badge={{ text: 'Ativo', variant: 'success' }}
        />
        <ListItem
          title="Item 2"
          description="Descrição do item 2"
          icon="settings"
          badge={{ text: 'Pendente', variant: 'warning' }}
        />
      </Card>

      <Card title="Progress Bar">
        <ProgressBar progress={0.8} showPercentage />
        <ProgressBar progress={0.5} showPercentage />
        <ProgressBar progress={0.3} showPercentage />
      </Card>

      <Card title="Modal">
        <Button onPress={() => setShowModal(true)}>Abrir Modal</Button>
      </Card>

      <Card title="Empty State">
        <EmptyState
          title="Nenhum item encontrado"
          description="Adicione itens para começar"
          action={{
            label: 'Adicionar Item',
            onPress: () => {},
          }}
        />
      </Card>

      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        title="Modal de Teste"
      >
        <Text>Este é um modal de teste.</Text>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  avatarRow: {
    flexDirection: 'row',
    gap: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});
```

## ✅ Checklist de Componentes UI

### Componentes Base
- [ ] Button
- [ ] Input
- [ ] Card
- [ ] Avatar
- [ ] Badge
- [ ] StatusBadge
- [ ] Modal
- [ ] EmptyState

### Componentes de Display de Dados
- [ ] ListItem
- [ ] ProgressBar
- [ ] DataTable (ver próximo guia)
- [ ] Chart (ver guia de gráficos)

### Componentes de Form
- [ ] FormField (ver próximo guia)
- [ ] FormSelect (ver próximo guia)
- [ ] FormCheckbox (ver próximo guia)
- [ ] FormSwitch (ver próximo guia)

### Componentes de Layout
- [ ] Header (ver guia de navegação)
- [ ] ScreenContainer (ver guia de navegação)
- [ ] LoadingSkeleton (ver guia de navegação)

## 🚨 Próximos Passos

Após completar os componentes UI base:

1. **Navegação**: Implementar estrutura de navegação com tabs
2. **Components Complexos**: DataTable, Forms, Charts
3. **Features**: Dashboard, Companies, People, etc.

---

**Próximo passo**: Siga o arquivo `04-NAVIGATION.md` para implementar a navegação do app.
