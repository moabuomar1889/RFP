-- Fix missing token RPCs
-- Run this in Supabase SQL Editor

-- Drop existing versions first
DROP FUNCTION IF EXISTS public.get_user_token_full(TEXT);
DROP FUNCTION IF EXISTS public.update_user_token(TEXT, TEXT, TIMESTAMPTZ);

-- 1. Get user token - returns single JSON object (not a table)
CREATE OR REPLACE FUNCTION public.get_user_token_full(p_email TEXT)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT row_to_json(t) INTO v_result
    FROM (
        SELECT 
            access_token_encrypted,
            refresh_token_encrypted,
            token_expiry
        FROM rfp.user_tokens
        WHERE LOWER(email) = LOWER(p_email)
        LIMIT 1
    ) t;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_user_token_full(TEXT) TO anon, authenticated, service_role;

-- 2. Update user token (for refreshing expired tokens)
CREATE OR REPLACE FUNCTION public.update_user_token(
    p_email TEXT,
    p_access_token TEXT,
    p_token_expiry TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE rfp.user_tokens
    SET access_token_encrypted = p_access_token,
        token_expiry = COALESCE(p_token_expiry, token_expiry),
        updated_at = NOW()
    WHERE LOWER(email) = LOWER(p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_user_token(TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated, service_role;

SELECT 'Token RPCs created successfully' AS status;
