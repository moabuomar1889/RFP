import { createClient } from '@supabase/supabase-js';

// Lazy-initialized clients to avoid build-time errors
let _supabase: ReturnType<typeof createClient> | null = null;
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

// Client-side Supabase client (uses anon key)
export function getSupabase() {
    if (!_supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) {
            throw new Error('Missing Supabase environment variables');
        }
        _supabase = createClient(url, key, {
            db: { schema: 'rfp' }
        });
    }
    return _supabase;
}

// Server-side Supabase client (uses service role key for admin operations)
export function getSupabaseAdmin() {
    if (!_supabaseAdmin) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !key) {
            throw new Error('Missing Supabase admin environment variables');
        }
        _supabaseAdmin = createClient(url, key, {
            db: { schema: 'rfp' }
        });
    }
    return _supabaseAdmin;
}

// Legacy exports for backwards compatibility
// These are lazy getters that call the functions
export const supabaseAdmin = {
    get schema() { return getSupabaseAdmin().schema.bind(getSupabaseAdmin()); },
    get from() { return getSupabaseAdmin().from.bind(getSupabaseAdmin()); },
    get rpc() { return getSupabaseAdmin().rpc.bind(getSupabaseAdmin()); },
};


