import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

const LOCAL_CREDENTIALS = {
  email: 'adrieltavares87@gmail.com',
  password: '91991589',
  user: {
    id: '1',
    name: 'Adriel Tavares',
    email: 'adrieltavares87@gmail.com',
    groupId: '1',
    groupRole: 'admin',
  } as User,
};

const AUTH_KEY = 'sync_auth_data';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    if (
      email === LOCAL_CREDENTIALS.email &&
      password === LOCAL_CREDENTIALS.password
    ) {
      const user = LOCAL_CREDENTIALS.user;
      await SecureStore.setItemAsync(AUTH_KEY, JSON.stringify(user));
      set({ user, isAuthenticated: true });
    } else {
      throw new Error('Email ou senha invalidos');
    }
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    set({ user: null, isAuthenticated: false });
  },

  loadSession: async () => {
    try {
      const raw = await SecureStore.getItemAsync(AUTH_KEY);
      if (raw) {
        const user = JSON.parse(raw) as User;
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
