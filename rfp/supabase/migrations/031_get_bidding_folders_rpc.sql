-- Create RPC to get bidding folders for cleanup
CREATE OR REPLACE FUNCTION public.get_bidding_folders()
RETURNS TABLE (
    id UUID,
    project_id UUID,
    drive_folder_id TEXT,
    template_path TEXT,
    physical_path TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fi.id,
        fi.project_id,
        fi.drive_folder_id,
        fi.template_path,
        fi.physical_path
    FROM rfp.folder_index fi
    WHERE fi.template_path ILIKE '%Bidding%'
      AND fi.drive_folder_id IS NOT NULL;
END;
$$;
