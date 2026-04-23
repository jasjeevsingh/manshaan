import { supabase } from './supabaseClient';

/**
 * Build request headers with Supabase access token when available.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
}

