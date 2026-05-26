import Constants from 'expo-constants';

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = Constants.expoConfig?.extra?.[key] || process.env[key];
  return value || defaultValue || '';
};

export const env = {
  apiBasePath: getEnvVar('EXPO_PUBLIC_API_BASE_URL', 'http://10.0.2.2:3000/api'),
  authTokenKey: 'sync_auth_token',
  userDataKey: 'sync_user_data',
};
