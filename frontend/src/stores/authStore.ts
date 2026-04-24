/**
 * Authentication Store
 * 
 * Manages user authentication state and session.
 */

import { create } from 'zustand';
import { supabase } from '../lib/supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

let _initPromise: Promise<void> | null = null;

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
        if (_initPromise) {
            return _initPromise;
        }

        const doInit = async () => {
        try {
            await new Promise<void>((resolve) => {
                let resolved = false;
                supabase.auth.onAuthStateChange((_event, session) => {
                    set({ session, user: session?.user || null });

                    if (session?.user) {
                        get().fetchChildren().catch(() => {});
                    } else {
                        set({ children: [] });
                    }

                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                });
            });
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error('Error getting initial session:', error);
            }
        } finally {
            set({ initialized: true, loading: false });
        }
        };

        _initPromise = doInit();
        return _initPromise;
    },
}));
