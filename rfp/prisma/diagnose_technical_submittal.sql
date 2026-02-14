-- Q9: Show full Bidding template tree with all nested children
WITH template AS (
    SELECT template_json FROM rfp.folder_templates WHERE is_active = true LIMIT 1
),
bidding_node AS (
    SELECT elem as node
    FROM template,
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(template_json) = 'array' THEN template_json
            ELSE template_json->'template'
        END
    ) as elem
    WHERE elem ->> 'name' = 'Bidding'
)
-- Level 1 children
SELECT 
    child ->> 'name' as level1_name,
    grandchild ->> 'name' as level2_name
FROM bidding_node,
jsonb_array_elements(node -> 'children') as child
LEFT JOIN LATERAL jsonb_array_elements(
    COALESCE(child -> 'children', '[]'::jsonb)
) as grandchild ON true
ORDER BY child ->> 'name', grandchild ->> 'name';

[
  {
    "level1_name": "Commercial Proposal",
    "level2_name": "Admin Only"
  },
  {
    "level1_name": "SOW",
    "level2_name": null
  },
  {
    "level1_name": "Technical Proposal",
    "level2_name": "TBE"
  },
  {
    "level1_name": "Technical Proposal",
    "level2_name": "Technical Submittal"
  },
  {
    "level1_name": "Vendors Quotations",
    "level2_name": "Civil and Finishes"
  },
  {
    "level1_name": "Vendors Quotations",
    "level2_name": "E&I"
  },
  {
    "level1_name": "Vendors Quotations",
    "level2_name": "IT"
  },
  {
    "level1_name": "Vendors Quotations",
    "level2_name": "Mechanical"
  }
]

-- Q10: What's in folder_index for PRJ-020 AFTER the fresh rebuild?
SELECT 
    template_path,
    normalized_template_path,
    drive_folder_id
FROM rfp.folder_index
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY normalized_template_path, template_path;


[
  {
    "template_path": "PRJ-020-RFP/4-PRJ-020-RFP-Commercial Propsal",
    "normalized_template_path": "Commercial Proposal",
    "drive_folder_id": "1QeX74lCtNUM9fOnEA9UK-ziDElpwVczS"
  },
  {
    "template_path": "PRJ-020-RFP/4-PRJ-020-RFP-Commercial Propsal/1-PRJ-020-RFP-Admin Only",
    "normalized_template_path": "Commercial Proposal/Admin Only",
    "drive_folder_id": "1NhZHGzvYXYvGedhHJCP3u5xv86TnkqUD"
  },
  {
    "template_path": "PRJ-020-RFP/1-PRJ-020-RFP-SOW",
    "normalized_template_path": "SOW",
    "drive_folder_id": "1bEOJNC3oQulPyn4s_46RBKpMx_IpRbkL"
  },
  {
    "template_path": "PRJ-020-RFP/2-PRJ-020-RFP-Technical Propsal",
    "normalized_template_path": "Technical Proposal",
    "drive_folder_id": "1b5kMHD0gKYC5qK5poqTf4A7FWuGfhXM2"
  },
  {
    "template_path": "PRJ-020-RFP/2-PRJ-020-RFP-Technical Propsal/1-PRJ-020-RFP-TBE",
    "normalized_template_path": "Technical Proposal/TBE",
    "drive_folder_id": "139pj0Sr7kQY2OWHmjL0wfrm3GDCeay8R"
  },
  {
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations",
    "normalized_template_path": "Vendors Quotations",
    "drive_folder_id": "1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN"
  },
  {
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations/1-PRJ-020-RFP-Civil and Finishes",
    "normalized_template_path": "Vendors Quotations/Civil and Finishes",
    "drive_folder_id": "18EsQEosydAEWMGuscyWtV5GDhf92B1ZI"
  },
  {
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations/3-PRJ-020-RFP-E&I",
    "normalized_template_path": "Vendors Quotations/E&I",
    "drive_folder_id": "1Cvb3KgRC6KBf8RD_MTUdHdRdTOQpPUGP"
  },
  {
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations/4-PRJ-020-RFP-IT",
    "normalized_template_path": "Vendors Quotations/IT",
    "drive_folder_id": "1jsTvPyHu3uhJrdMvAj7Obw0fAUmlNjtj"
  },
  {
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations/2-PRJ-020-RFP-Mechanical",
    "normalized_template_path": "Vendors Quotations/Mechanical",
    "drive_folder_id": "1xnVBsj5TLVqdrc3NfSImerTrZ1a2Iuhx"
  }
]