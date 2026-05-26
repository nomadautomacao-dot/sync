import { create } from 'zustand';

interface UIState {
  isLoading: boolean;
  toasts: { id: string; message: string; type: string }[];
  addToast: (msg: { message: string; type: string }) => void;
  removeToast: (id: string) => void;
  setGlobalLoading: (isLoading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoading: false,
  toasts: [],
  addToast: (msg) => {
    const id = Date.now().toString();
    set((state) => ({ toasts: [...state.toasts, { ...msg, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) })),
  setGlobalLoading: (isLoading) => set({ isLoading }),
}));
