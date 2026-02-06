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

// Export a getter that returns the actual client for proper method chaining
export const supabaseAdmin = {
    get schema() {
        return (name: string) => getSupabaseAdmin().schema(name);
    },
    get from() {
        return (table: string) => getSupabaseAdmin().from(table);
    },
    get rpc() {
        return (fn: string, params?: Record<string, unknown>) => getSupabaseAdmin().rpc(fn, params);
    },
};

// Also export a function to get the raw client when needed
export function getRawSupabaseAdmin(): SupabaseClient {
    return getSupabaseAdmin();
}
