-- =============================================
-- DIAGNOSE: Why Enforce skips Technical Submittal
-- =============================================

-- 1. Check folder_index columns first
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'rfp' AND table_name = 'folder_index'
ORDER BY ordinal_position;
[
  {
    "column_name": "id"
  },
  {
    "column_name": "project_id"
  },
  {
    "column_name": "drive_folder_id"
  },
  {
    "column_name": "template_path"
  },
  {
    "column_name": "expected_limited_access"
  },
  {
    "column_name": "expected_groups"
  },
  {
    "column_name": "expected_users"
  },
  {
    "column_name": "actual_limited_access"
  },
  {
    "column_name": "last_verified_at"
  },
  {
    "column_name": "is_compliant"
  },
  {
    "column_name": "created_at"
  },
  {
    "column_name": "updated_at"
  },
  {
    "column_name": "normalized_template_path"
  }
]
-- 2. Check folder_index for PRJ-020 (all columns)
SELECT * FROM rfp.folder_index 
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020' LIMIT 1)
ORDER BY template_path;
[
  {
    "id": "404bcd5f-874f-41e5-8964-584cdf46cc37",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1QeX74lCtNUM9fOnEA9UK-ziDElpwVczS",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Commercial Propsal",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:43.830621+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:43.830621+00",
    "updated_at": "2026-02-14 04:34:43.830621+00",
    "normalized_template_path": "Commercial Proposal"
  },
  {
    "id": "ac01964b-a34c-4bae-a106-efdccd8cc764",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1NhZHGzvYXYvGedhHJCP3u5xv86TnkqUD",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Commercial Propsal/PRJ-020-RFP-Admin Only",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:44.087188+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:44.087188+00",
    "updated_at": "2026-02-14 04:34:44.087188+00",
    "normalized_template_path": "Commercial Proposal/Admin Only"
  },
  {
    "id": "39002773-0b47-487d-91ba-17537d28ed06",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1bEOJNC3oQulPyn4s_46RBKpMx_IpRbkL",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-SOW",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:42.746051+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:42.746051+00",
    "updated_at": "2026-02-14 04:34:42.746051+00",
    "normalized_template_path": "SOW"
  },
  {
    "id": "d0539701-93d7-4606-869b-3d3d9bd6a64a",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1b5kMHD0gKYC5qK5poqTf4A7FWuGfhXM2",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Technical Propsal",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:43.012191+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:43.012191+00",
    "updated_at": "2026-02-14 04:34:43.012191+00",
    "normalized_template_path": "Technical Proposal"
  },
  {
    "id": "1103a113-f46c-42b6-a74d-e249e1e363c7",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "139pj0Sr7kQY2OWHmjL0wfrm3GDCeay8R",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Technical Propsal/PRJ-020-RFP-TBE",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:43.293098+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:43.293098+00",
    "updated_at": "2026-02-14 04:34:43.293098+00",
    "normalized_template_path": "Technical Proposal/TBE"
  },
  {
    "id": "e3d0cf88-f4e4-46d5-b920-14458d10ed7d",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1K816PbzsmIyQR4-YTxMi7_eLUcAoQR4o",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Technical Propsal/PRJ-020-RFP-Technical Submittal",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:43.554648+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:43.554648+00",
    "updated_at": "2026-02-14 04:34:43.554648+00",
    "normalized_template_path": "Technical Proposal/Technical Submittal"
  },
  {
    "id": "fa673718-28ef-45ab-94f0-847a85536b3c",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1_W30XeBmrJFI6xslYDuSByZNwQK2JRBN",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Vendors Quotations",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:41.368301+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:41.368301+00",
    "updated_at": "2026-02-14 04:34:41.368301+00",
    "normalized_template_path": "Vendors Quotations"
  },
  {
    "id": "ca3a5063-7534-41bd-a2c0-49a45770e6d1",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "18EsQEosydAEWMGuscyWtV5GDhf92B1ZI",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Vendors Quotations/PRJ-020-RFP-Civil and Finishes",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:41.670597+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:41.670597+00",
    "updated_at": "2026-02-14 04:34:41.670597+00",
    "normalized_template_path": "Vendors Quotations/Civil and Finishes"
  },
  {
    "id": "ee336467-3844-477f-b4fb-7975bdb8c59a",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1Cvb3KgRC6KBf8RD_MTUdHdRdTOQpPUGP",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Vendors Quotations/PRJ-020-RFP-E&I",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:42.20301+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:42.20301+00",
    "updated_at": "2026-02-14 04:34:42.20301+00",
    "normalized_template_path": "Vendors Quotations/E&I"
  },
  {
    "id": "fefe4ee9-a106-4550-95e2-d5bc98714ae4",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1jsTvPyHu3uhJrdMvAj7Obw0fAUmlNjtj",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Vendors Quotations/PRJ-020-RFP-IT",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:42.468562+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:42.468562+00",
    "updated_at": "2026-02-14 04:34:42.468562+00",
    "normalized_template_path": "Vendors Quotations/IT"
  },
  {
    "id": "d0a9d274-6c47-4279-b435-d4f8a5a34856",
    "project_id": "5d60e037-58d9-4dc7-aaa9-d9601a5b9c92",
    "drive_folder_id": "1xnVBsj5TLVqdrc3NfSImerTrZ1a2Iuhx",
    "template_path": "PRJ-020-RFP/PRJ-020-RFP-Vendors Quotations/PRJ-020-RFP-Mechanical",
    "expected_limited_access": false,
    "expected_groups": [],
    "expected_users": [],
    "actual_limited_access": null,
    "last_verified_at": "2026-02-14 04:34:41.928083+00",
    "is_compliant": false,
    "created_at": "2026-02-14 04:34:41.928083+00",
    "updated_at": "2026-02-14 04:34:41.928083+00",
    "normalized_template_path": "Vendors Quotations/Mechanical"
  }
]
-- 3. Check audit_log columns
SELECT column_name FROM information_schema.columns 
WHERE table_schema = 'rfp' AND table_name = 'audit_log'
ORDER BY ordinal_position;
[
  {
    "column_name": "id"
  },
  {
    "column_name": "action"
  },
  {
    "column_name": "entity_type"
  },
  {
    "column_name": "entity_id"
  },
  {
    "column_name": "old_value"
  },
  {
    "column_name": "new_value"
  },
  {
    "column_name": "details"
  },
  {
    "column_name": "performed_by"
  },
  {
    "column_name": "ip_address"
  },
  {
    "column_name": "created_at"
  }
]
-- 4. Check recent enforce logs for PRJ-020
SELECT action, details
FROM rfp.audit_log
WHERE entity_type = 'job' 
  AND details::text LIKE '%PRJ-020%'
ORDER BY created_at DESC
LIMIT 15;
Success. No rows returned


