/**
 * Authentication Store
 * 
 * Manages user authentication state and session.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

export interface Child {
    id: string;
    parent_id: string;
    name: string;
    date_of_birth?: string;
    notes?: string;
    created_at: string;
}

export interface AuthState {
    user: User | null;
    session: Session | null;
    children: Child[];
    loading: boolean;
    initialized: boolean;

    // Actions
    setSession: (session: Session | null) => void;
    setUser: (user: User | null) => void;
    setChildren: (children: Child[]) => void;
    signOut: () => Promise<void>;
    fetchChildren: () => Promise<void>;
    addChild: (childData: Partial<Child>) => Promise<Child>;
    deleteChild: (childId: string) => Promise<void>;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    session: null,
    children: [],
    loading: true,
    initialized: false,

    setSession: (session) => set({ session }),

    setUser: (user) => set({ user }),

    setChildren: (children) => set({ children }),

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null, children: [] });
    },

    fetchChildren: async () => {
        const { user } = get();
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('children')
                .select('*')
                .eq('parent_id', user.id);

            if (error) throw error;
            set({ children: data || [] });
        } catch (error) {
            console.error('Error fetching children:', error);
        }
    },

    addChild: async (childData) => {
        const { user } = get();
        if (!user) throw new Error('Not authenticated');

        const { data, error } = await supabase
            .from('children')
            .insert([{ ...childData, parent_id: user.id }])
            .select()
            .single();

        if (error) throw error;

        const { children } = get();
        set({ children: [...children, data] });
        return data;
    },

    deleteChild: async (childId) => {
        const { error } = await supabase
            .from('children')
            .delete()
            .eq('id', childId);

        if (error) throw error;

        const { children } = get();
        set({ children: children.filter(c => c.id !== childId) });
    },

    initialize: async () => {
        try {
            // Get initial session
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                set({ session, user: session.user });
                await get().fetchChildren();
            }

            // Listen for auth changes
            supabase.auth.onAuthStateChange(async (_event, session) => {
                set({ session, user: session?.user || null });

                if (session?.user) {
                    await get().fetchChildren();
                } else {
                    set({ children: [] });
                }
            });

            set({ initialized: true, loading: false });
        } catch (error) {
            console.error('Error initializing auth:', error);
            set({ initialized: true, loading: false });
        }
    },
}));
