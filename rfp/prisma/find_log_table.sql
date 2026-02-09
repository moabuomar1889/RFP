-- Find the correct job logs table name
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'rfp' 
  AND table_name LIKE '%job%'
ORDER BY table_name;

-- Also check for log tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'rfp' 
  AND table_name LIKE '%log%'
ORDER BY table_name;
