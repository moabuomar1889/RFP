-- Migration: Add upsert_user_token RPC that handles NULL refresh token
-- Google only provides refresh_token on first authorization
-- On subsequent logins, we must preserve the existing refresh_token
-- Run this in Supabase SQL Editor

-- Drop if exists
DROP FUNCTION IF EXISTS public.upsert_user_token(TEXT, TEXT, TEXT, TIMESTAMPTZ);

-- Create the function
CREATE OR REPLACE FUNCTION public.upsert_user_token(
    p_email TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT,
    p_token_expiry TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_existing_refresh TEXT;
BEGIN
    -- If refresh_token is null, try to get existing one
    IF p_refresh_token IS NULL THEN
        SELECT refresh_token_encrypted INTO v_existing_refresh
        FROM rfp.user_tokens
        WHERE email = p_email;
        
        -- If no existing refresh token, we can't proceed
        IF v_existing_refresh IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'No refresh token available');
        END IF;
    ELSE
        v_existing_refresh := p_refresh_token;
    END IF;
    
    -- Upsert the token
    INSERT INTO rfp.user_tokens (email, access_token_encrypted, refresh_token_encrypted, token_expiry, updated_at)
    VALUES (p_email, p_access_token, v_existing_refresh, p_token_expiry, NOW())
    ON CONFLICT (email) 
    DO UPDATE SET
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = COALESCE(NULLIF(EXCLUDED.refresh_token_encrypted, ''), rfp.user_tokens.refresh_token_encrypted),
        token_expiry = EXCLUDED.token_expiry,
        updated_at = NOW();
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.upsert_user_token(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
