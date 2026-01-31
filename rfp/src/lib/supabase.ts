import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid build-time errors
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

// Client-side Supabase client (uses anon key)
export function getSupabase(): SupabaseClient {
    if (!_supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) {
            throw new Error('Missing Supabase environment variables');
        }
        _supabase = createClient(url, key);
    }
    return _supabase;
}

// Server-side Supabase client (uses service role key for admin operations)
export function getSupabaseAdmin(): SupabaseClient {
    if (!_supabaseAdmin) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error('Missing Supabase admin environment variables');
        }
        _supabaseAdmin = createClient(url, key);
    }
    return _supabaseAdmin;
}

// Legacy exports for backwards compatibility (deprecated)
export const supabase = null as unknown as SupabaseClient;
export const supabaseAdmin = null as unknown as SupabaseClient;
