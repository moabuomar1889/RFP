-- ═══════════════════════════════════════════════════════════════
-- DIAGNOSTIC: Deep investigation of PRJ-020 data
-- Run each section one at a time in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ═══ Q1: What phase is PRJ-020 in? ═══
SELECT id, pr_number, name, phase, drive_folder_id  
FROM rfp.projects 
WHERE pr_number = 'PRJ-020';


[
  {
    "id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "pr_number": "PRJ-020",
    "name": "Cylinder Storage (O2 and CO2) and MTI Roof",
    "phase": "bidding",
    "drive_folder_id": "19UGh996wNxczZU-PRkLlL7mDNjF1phmO"
  }
]


-- ═══ Q2: What does the folder_index contain for PRJ-020? ═══
-- Shows: raw Drive path, normalized path, drive_folder_id
SELECT 
    template_path, 
    normalized_template_path,
    drive_folder_id
FROM rfp.folder_index 
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
ORDER BY template_path;


[
  {
    "template_path": "PRJ-020-RFP",
    "normalized_template_path": null,
    "drive_folder_id": "1A-LFJlyhYrCgsDUnnnVis5fol0L78t1X"
  },
  {
    "template_path": "PRJ-020-RFP/1-PRJ-020-RFP-SOW",
    "normalized_template_path": "SOW",
    "drive_folder_id": "1bEOJNC3oQulPyn4s_46RBKpMx_IpRbkL"
  },
  {
    "template_path": "PRJ-020-RFP/1-PRJ-020-RFP-SOW/Reference Dwgs",
    "normalized_template_path": null,
    "drive_folder_id": "1m_CiaHqxpps4sPjh0ebVrIPTmjvFfAnq"
  },
  {
    "template_path": "PRJ-020-RFP/2-PRJ-020-RFP-Technical Propsal",
    "normalized_template_path": null,
    "drive_folder_id": "1b5kMHD0gKYC5qK5poqTf4A7FWuGfhXM2"
  },
  {
    "template_path": "PRJ-020-RFP/2-PRJ-020-RFP-Technical Propsal/1-PRJ-020-RFP-TBE",
    "normalized_template_path": null,
    "drive_folder_id": "139pj0Sr7kQY2OWHmjL0wfrm3GDCeay8R"
  },
  {
    "template_path": "PRJ-020-RFP/2-PRJ-020-RFP-Technical Propsal/2-PRJ-020-RFP-Technical Proposal",
    "normalized_template_path": null,
    "drive_folder_id": "1K816PbzsmIyQR4-YTxMi7_eLUcAoQR4o"
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
    "template_path": "PRJ-020-RFP/3-PRJ-020-RFP-Vendors Quotations/2-PRJ-020-RFP-Mechanical",
    "normalized_template_path": "Vendors Quotations/Mechanical",
    "drive_folder_id": "1xnVBsj5TLVqdrc3NfSImerTrZ1a2Iuhx"
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
    "template_path": "PRJ-020-RFP/4-PRJ-020-RFP-Commercial Propsal",
    "normalized_template_path": null,
    "drive_folder_id": "1QeX74lCtNUM9fOnEA9UK-ziDElpwVczS"
  },
  {
    "template_path": "PRJ-020-RFP/4-PRJ-020-RFP-Commercial Propsal/1-PRJ-020-RFP-Admin Only",
    "normalized_template_path": null,
    "drive_folder_id": "1NhZHGzvYXYvGedhHJCP3u5xv86TnkqUD"
  }
]

-- ═══ Q3: What does the template look like? ═══
-- Shows top-level nodes and their children names
SELECT 
    version_number,
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(template_json) = 'array' THEN template_json
            ELSE template_json->'template'
        END
    ) ->> 'text' as phase_name,
    jsonb_array_length(
        jsonb_array_elements(
            CASE 
                WHEN jsonb_typeof(template_json) = 'array' THEN template_json
                ELSE template_json->'template'
            END
        ) -> 'children'
    ) as child_count
FROM rfp.folder_templates 
WHERE is_active = true;


[
  {
    "version_number": 102,
    "phase_name": null,
    "child_count": 9
  },
  {
    "version_number": 102,
    "phase_name": null,
    "child_count": 4
  }
]


-- ═══ Q4: List ALL template children with their phase ═══
-- This shows which folders belong to Bidding vs Project Delivery
WITH template AS (
    SELECT template_json FROM rfp.folder_templates WHERE is_active = true LIMIT 1
),
phases AS (
    SELECT 
        elem ->> 'text' as phase_name,
        elem -> 'children' as children
    FROM template,
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(template_json) = 'array' THEN template_json
            ELSE template_json->'template'
        END
    ) as elem
)
SELECT 
    phase_name,
    child ->> 'text' as folder_name,
    jsonb_array_length(COALESCE(child -> 'children', '[]'::jsonb)) as sub_children
FROM phases,
jsonb_array_elements(children) as child
ORDER BY phase_name, child ->> 'text';
[
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 2
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 4
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 1
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 4
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 2
  },
  {
    "phase_name": null,
    "folder_name": null,
    "sub_children": 0
  }
]