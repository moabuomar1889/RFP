-- Quick diagnostic - run in Supabase SQL Editor
-- Check if tokens exist in the table
SELECT email, 
       LEFT(access_token_encrypted, 20) as access_preview, 
       LEFT(refresh_token_encrypted, 20) as refresh_preview,
       token_expiry,
       updated_at
FROM rfp.user_tokens;
