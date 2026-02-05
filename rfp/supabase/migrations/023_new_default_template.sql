-- ═══════════════════════════════════════════════════════════════════════════
-- NEW DEFAULT TEMPLATE FROM PRJ-014 EXTRACTION
-- Generated: 2026-02-05
-- Run this ENTIRE script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- Deactivate all existing templates
UPDATE rfp.template_versions SET is_active = false;

-- Get the next version number and insert the new template
DO $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version FROM rfp.template_versions;
    
    INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
    VALUES (
        v_version,
        '[
  {
    "name": "Project Delivery",
    "limitedAccess": false,
    "groups": [
      {"email": "technical-team@dtgsa.com", "role": "reader"},
      {"email": "dc-team@dtgsa.com", "role": "reader"},
      {"email": "survey-team@dtgsa.com", "role": "reader"},
      {"email": "projects-control@dtgsa.com", "role": "reader"},
      {"email": "admin@dtgsa.com", "role": "organizer"},
      {"email": "quality-control@dtgsa.com", "role": "reader"},
      {"email": "projects-managers@dtgsa.com", "role": "reader"}
    ],
    "children": [
      {
        "name": "Quantity Survey",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ]
      },
      {
        "name": "Engineering (EPC ONLY)",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ]
      },
      {
        "name": "Project Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ],
        "children": [
          {
            "name": "Commercial",
            "limitedAccess": true,
            "groups": [
              {"email": "projects-control@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Invoices",
                "limitedAccess": true,
                "groups": [
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              },
              {
                "name": "Agreements",
                "limitedAccess": true,
                "groups": [
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {
                    "name": "Change Orders",
                    "limitedAccess": true,
                    "groups": [
                      {"email": "admin@dtgsa.com", "role": "organizer"},
                      {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                    ]
                  },
                  {
                    "name": "Contract & PO",
                    "limitedAccess": true,
                    "groups": [
                      {"email": "admin@dtgsa.com", "role": "organizer"},
                      {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                    ]
                  }
                ]
              }
            ]
          },
          {
            "name": "Planning",
            "limitedAccess": true,
            "groups": [
              {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"}
            ],
            "children": [
              {
                "name": "Planning Deliverables",
                "limitedAccess": true,
                "groups": [
                  {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"}
                ]
              },
              {
                "name": "Reports",
                "limitedAccess": true,
                "groups": [
                  {"email": "projects-control@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"}
                ]
              }
            ]
          }
        ]
      },
      {
        "name": "Quality Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "fileOrganizer"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ]
      },
      {
        "name": "Document Control",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ],
        "children": [
          {
            "name": "MDR",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          },
          {
            "name": "Forms",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "reader"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          },
          {
            "name": "Transmittals",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Sent",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              },
              {
                "name": "Received",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ]
              }
            ]
          },
          {
            "name": "Submittals",
            "limitedAccess": true,
            "groups": [
              {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
            ],
            "children": [
              {
                "name": "Received",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {"name": "SI & CCCOR", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Letters", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Quality Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Project Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Procurement", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Minutes of Meetings", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "EHS", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Construction", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
                ]
              },
              {
                "name": "Ongoing",
                "limitedAccess": true,
                "groups": [
                  {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
                  {"email": "admin@dtgsa.com", "role": "organizer"},
                  {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
                ],
                "children": [
                  {"name": "SI & CCCOR", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Letters", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Quality Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Project Control", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Procurement", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Minutes of Meetings", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "EHS", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
                  {"name": "Construction", "limitedAccess": true, "groups": [{"email": "dc-team@dtgsa.com", "role": "fileOrganizer"}, {"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
                ]
              }
            ]
          }
        ]
      },
      {
        "name": "Survey",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "Operation",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "IFC Drawings",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      },
      {
        "name": "HSE",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "reader"}
        ]
      }
    ]
  },
  {
    "name": "Bidding",
    "limitedAccess": false,
    "groups": [
      {"email": "technical-team@dtgsa.com", "role": "reader"},
      {"email": "dc-team@dtgsa.com", "role": "reader"},
      {"email": "survey-team@dtgsa.com", "role": "reader"},
      {"email": "projects-control@dtgsa.com", "role": "reader"},
      {"email": "admin@dtgsa.com", "role": "organizer"},
      {"email": "quality-control@dtgsa.com", "role": "reader"},
      {"email": "projects-managers@dtgsa.com", "role": "reader"}
    ],
    "children": [
      {
        "name": "Commercial Proposal",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ],
        "children": [
          {
            "name": "Admin Only",
            "limitedAccess": true,
            "groups": [
              {"email": "admin@dtgsa.com", "role": "organizer"},
              {"email": "projects-managers@dtgsa.com", "role": "reader"}
            ]
          }
        ]
      },
      {
        "name": "Vendors Quotations",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}
        ],
        "children": [
          {"name": "Civil and Finishes", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "IT", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "E&I", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]},
          {"name": "Mechanical", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "fileOrganizer"}]}
        ]
      },
      {
        "name": "Technical Proposal",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "reader"},
          {"email": "dc-team@dtgsa.com", "role": "reader"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "reader"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ],
        "children": [
          {"name": "TBE", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "writer"}]},
          {"name": "Technical Proposal", "limitedAccess": true, "groups": [{"email": "admin@dtgsa.com", "role": "organizer"}, {"email": "projects-managers@dtgsa.com", "role": "writer"}]}
        ]
      },
      {
        "name": "SOW",
        "limitedAccess": false,
        "groups": [
          {"email": "technical-team@dtgsa.com", "role": "writer"},
          {"email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
          {"email": "survey-team@dtgsa.com", "role": "reader"},
          {"email": "projects-control@dtgsa.com", "role": "writer"},
          {"email": "admin@dtgsa.com", "role": "organizer"},
          {"email": "quality-control@dtgsa.com", "role": "reader"},
          {"email": "projects-managers@dtgsa.com", "role": "writer"}
        ]
      }
    ]
  }
]'::jsonb,
        'system_extracted_prj014',
        true
    );
    
    RAISE NOTICE 'New template version % created successfully', v_version;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Check the new active template
-- ═══════════════════════════════════════════════════════════════════════════
SELECT 
    version_number,
    created_by,
    is_active,
    created_at,
    jsonb_array_length(template_json) as phase_count
FROM rfp.template_versions
WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- END - Run this entire script in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════
