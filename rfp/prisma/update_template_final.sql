-- ============================================================================
-- UPDATE TEMPLATE - Insert Latest Version & Clean Up Old Versions
-- ============================================================================
-- This script inserts the latest template from template_output.json
-- and optionally cleans up old versions

BEGIN;

-- Step 1: Insert the new template version
-- The version number auto-increments from the current max version
INSERT INTO rfp.folder_templates (
    version_number,
    template_json,
    is_active,
    created_by,
    notes,
    created_at
)
SELECT 
    COALESCE(MAX(version_number), 0) + 1 as version_number,
    '[
  {
    "name": "Project Delivery",
    "users": [],
    "groups": [],
    "children": [
      {
        "name": "Quantity Survey",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "Engineering (EPC ONLY)",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "Project Control",
        "users": [],
        "groups": [],
        "children": [
          {
            "name": "Commercial",
            "users": [],
            "groups": [],
            "children": [
              {
                "name": "Invoices",
                "users": [],
                "groups": [],
                "limitedAccess": false
              },
              {
                "name": "Agreements",
                "users": [],
                "groups": [],
                "children": [
                  {
                    "name": "Change Orders",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Contract & PO",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  }
                ],
                "limitedAccess": false
              }
            ],
            "limitedAccess": false
          },
          {
            "name": "Planning",
            "users": [],
            "groups": [],
            "children": [
              {
                "name": "Planning Deliverables",
                "users": [],
                "groups": [],
                "limitedAccess": false
              },
              {
                "name": "Reports",
                "users": [],
                "groups": [],
                "limitedAccess": false
              }
            ],
            "limitedAccess": false
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Quality Control",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "Document Control",
        "users": [],
        "groups": [],
        "children": [
          {
            "name": "MDR",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "Forms",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "Transmittals",
            "users": [],
            "groups": [],
            "children": [
              {
                "name": "Sent",
                "users": [],
                "groups": [],
                "limitedAccess": false
              },
              {
                "name": "Received",
                "users": [],
                "groups": [],
                "limitedAccess": false
              }
            ],
            "limitedAccess": false
          },
          {
            "name": "Submittals",
            "users": [],
            "groups": [],
            "children": [
              {
                "name": "Received",
                "users": [],
                "groups": [],
                "children": [
                  {
                    "name": "SI & CCCOR",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Letters",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Quality Control",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Project Control",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Procurement",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Minutes of Meetings",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "EHS",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Construction",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  }
                ],
                "limitedAccess": false
              },
              {
                "name": "Ongoing",
                "users": [],
                "groups": [],
                "children": [
                  {
                    "name": "SI & CCCOR",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Letters",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Quality Control",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Project Control",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Procurement",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Minutes of Meetings",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "EHS",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  },
                  {
                    "name": "Construction",
                    "users": [],
                    "groups": [],
                    "limitedAccess": false
                  }
                ],
                "limitedAccess": false
              }
            ],
            "limitedAccess": false
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Survey",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "Operation",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "IFC Drawings",
        "users": [],
        "groups": [],
        "limitedAccess": false
      },
      {
        "name": "HSE",
        "users": [],
        "groups": [],
        "limitedAccess": false
      }
    ],
    "limitedAccess": false
  },
  {
    "name": "Bidding",
    "users": [],
    "groups": [],
    "children": [
      {
        "name": "Commercial Proposal",
        "users": [],
        "groups": [],
        "children": [
          {
            "name": "Admin Only",
            "users": [],
            "groups": [],
            "limitedAccess": false
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Vendors Quotations",
        "users": [],
        "groups": [],
        "children": [
          {
            "name": "Civil and Finishes",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "IT",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "E&I",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "Mechanical",
            "users": [],
            "groups": [],
            "limitedAccess": false
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Technical Proposal",
        "users": [],
        "groups": [],
        "children": [
          {
            "name": "TBE",
            "users": [],
            "groups": [],
            "limitedAccess": false
          },
          {
            "name": "Technical Submittal",
            "users": [],
            "groups": [],
            "limitedAccess": false
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "SOW",
        "users": [],
        "groups": [],
        "limitedAccess": false
      }
    ],
    "limitedAccess": false
  }
]'::jsonb as template_json,
    true as is_active,
    'admin' as created_by,
    'Final template with TBE and Technical Submittal updates' as notes,
    NOW() as created_at
FROM rfp.folder_templates;

-- Step 2: Mark all previous versions as inactive
UPDATE rfp.folder_templates
SET is_active = false
WHERE version_number < (SELECT MAX(version_number) FROM rfp.folder_templates);

-- Step 3: (OPTIONAL) Delete old versions - UNCOMMENT TO EXECUTE
-- Keep only the latest version
-- DELETE FROM rfp.folder_templates
-- WHERE version_number < (SELECT MAX(version_number) FROM rfp.folder_templates);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check the new version was inserted
SELECT 
    version_number,
    is_active,
    created_at,
    created_by,
    notes,
    jsonb_array_length(template_json::jsonb) as root_folder_count
FROM rfp.folder_templates
ORDER BY version_number DESC;

-- Count active versions (should be exactly 1)
SELECT COUNT(*) as active_versions
FROM rfp.folder_templates
WHERE is_active = true;

-- Check specific folders in the new template
SELECT 
    version_number,
    elem->>'name' as folder_name
FROM rfp.folder_templates,
     jsonb_array_elements(template_json::jsonb) as elem
WHERE is_active = true;
