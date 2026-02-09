-- Fix PRJ-019 folder paths - normalize from old format to new template format
-- Old: PRJ-019-RFP/1-PRJ-019-RFP-SOW
-- New: Bidding/SOW

-- First, let's see what the normalized_template_path column has
SELECT template_path, normalized_template_path
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY template_path;

-- Normalize all PRJ-019 paths to Bidding/* format
UPDATE rfp.folder_index
SET normalized_template_path = CASE
    -- Root folder
    WHEN template_path = 'PRJ-019-RFP' THEN 'Bidding'
    
    -- Level 1 folders - strip number prefix and project code
    WHEN template_path = 'PRJ-019-RFP/1-PRJ-019-RFP-SOW' THEN 'Bidding/SOW'
    WHEN template_path = 'PRJ-019-RFP/2-PRJ-019-RFP-Technical Propsal' THEN 'Bidding/Technical Proposal'
    WHEN template_path = 'PRJ-019-RFP/3-PRJ-019-RFP-Vendors Quotations' THEN 'Bidding/Vendors Quotations'
    WHEN template_path = 'PRJ-019-RFP/4-PRJ-019-RFP-Commercial Propsal' THEN 'Bidding/Commercial Proposal'
    
    -- Level 2 folders under Technical Proposal
    WHEN template_path = 'PRJ-019-RFP/2-PRJ-019-RFP-Technical Propsal/1-PRJ-019-RFP-TBE' THEN 'Bidding/Technical Proposal/TBE'
    WHEN template_path = 'PRJ-019-RFP/2-PRJ-019-RFP-Technical Propsal/2-PRJ-019-RFP-Technical Proposal' THEN 'Bidding/Technical Proposal/Technical Submittal'
    
    -- Level 2 folders under Vendors Quotations
    WHEN template_path = 'PRJ-019-RFP/3-PRJ-019-RFP-Vendors Quotations/1-PRJ-019-RFP-Civil and Finishes' THEN 'Bidding/Vendors Quotations/Civil and Finishes'
    WHEN template_path = 'PRJ-019-RFP/3-PRJ-019-RFP-Vendors Quotations/2-PRJ-019-RFP-Mechanical' THEN 'Bidding/Vendors Quotations/Mechanical'
    WHEN template_path = 'PRJ-019-RFP/3-PRJ-019-RFP-Vendors Quotations/3-PRJ-019-RFP-E&I' THEN 'Bidding/Vendors Quotations/E&I'
    WHEN template_path = 'PRJ-019-RFP/3-PRJ-019-RFP-Vendors Quotations/4-PRJ-019-RFP-IT' THEN 'Bidding/Vendors Quotations/IT'
    
    -- Level 2 folders under Commercial Proposal
    WHEN template_path = 'PRJ-019-RFP/4-PRJ-019-RFP-Commercial Propsal/1-PRJ-019-RFP-Admin Only' THEN 'Bidding/Commercial Proposal/Admin Only'
    
    -- Keep existing normalized path for already-normalized entries
    WHEN template_path = 'Bidding/Technical Proposal/Technical Submittal' THEN 'Bidding/Technical Proposal/Technical Submittal'
    
    ELSE normalized_template_path
END
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid;

-- Verify normalization
SELECT template_path, normalized_template_path
FROM rfp.folder_index
WHERE project_id = 'd5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid
ORDER BY normalized_template_path;

-- Now check what list_project_folders returns (with proper UUID cast)
SELECT * FROM rfp.list_project_folders('d5cf388d-c9ae-4e27-b8b4-b7e7dc81681c'::uuid);
