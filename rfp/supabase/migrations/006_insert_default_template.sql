-- Migration: Update or Insert the correct default template
-- Run this in Supabase SQL Editor

-- First, delete any existing templates to avoid conflicts
DELETE FROM rfp.template_versions WHERE version_number = 1;

-- Insert the correct default template
INSERT INTO rfp.template_versions (version_number, template_json, created_by, is_active)
VALUES (
    1,
    '[
      {
        "_expanded": true,
        "limitedAccess": false,
        "groups": [],
        "nodes": [
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Technical Team", "role": "writer"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "Projects Control", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "SOW",
            "users": []
          },
          {
            "_expanded": true,
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "nodes": [
              {"limitedAccess": false, "text": "TBE"},
              {"limitedAccess": false, "text": "Technical Proposal"}
            ],
            "text": "Technical Propsal",
            "users": [{"type": "user", "email": "Marwan@dtgsa.com", "role": "fileOrganizer"}]
          },
          {
            "_expanded": true,
            "limitedAccess": true,
            "groups": [
              {"name": "Admins", "role": "organizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "nodes": [
              {"limitedAccess": false, "text": "Civil and Finishes"},
              {"limitedAccess": false, "text": "Mechanical"},
              {"limitedAccess": false, "text": "E&I"},
              {"limitedAccess": false, "text": "IT"}
            ],
            "text": "Vendors Quotations",
            "users": []
          },
          {
            "groups": [{"name": "Projects Managers", "role": "writer"}],
            "limitedAccess": true,
            "text": "Commercial Propsal",
            "users": []
          }
        ],
        "text": "Bidding",
        "users": []
      },
      {
        "_expanded": true,
        "groups": [],
        "limitedAccess": false,
        "nodes": [
          {
            "_expanded": true,
            "groups": [
              {"name": "Document Control", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Projects Managers", "email": "projects-managers@dtgsa.com", "role": "fileOrganizer"},
              {"name": "Admins", "email": "admin@dtgsa.com", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "Forms", "folderType": "PD", "users": []},
              {"groups": [], "limitedAccess": true, "nodes": [], "text": "MDR", "folderType": "PD", "users": []},
              {
                "nodes": [
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Ongoing",
                    "folderType": "PD",
                    "users": []
                  },
                  {
                    "nodes": [
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Construction", "folderType": "PD", "users": []},
                      {"limitedAccess": false, "groups": [], "nodes": [], "text": "EHS", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Minutes of Meetings", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Procurment", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Project Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Quality Control", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "Letters", "folderType": "PD", "users": []},
                      {"groups": [], "limitedAccess": false, "nodes": [], "text": "SI & CCCOR", "folderType": "PD", "users": []}
                    ],
                    "_expanded": true,
                    "limitedAccess": false,
                    "groups": [],
                    "text": "Received",
                    "folderType": "PD",
                    "users": []
                  }
                ],
                "_expanded": true,
                "groups": [],
                "limitedAccess": false,
                "text": "Submittals",
                "folderType": "PD",
                "users": []
              },
              {
                "limitedAccess": false,
                "groups": [],
                "nodes": [
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Received", "folderType": "PD", "users": []},
                  {"limitedAccess": false, "groups": [], "nodes": [], "text": "Sent", "folderType": "PD", "users": []}
                ],
                "text": "Transmittals",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Document Control",
            "users": []
          },
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Quality Control", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "reader"},
              {"name": "Projects Managers", "role": "writer"},
              {"name": "dc team", "email": "dc-team@dtgsa.com", "role": "fileOrganizer"}
            ],
            "text": "Quality Control",
            "users": []
          },
          {"limitedAccess": false, "text": "HSE"},
          {
            "_expanded": true,
            "groups": [
              {"name": "Projects Control", "role": "fileOrganizer"},
              {"name": "Admins", "role": "organizer"}
            ],
            "limitedAccess": true,
            "nodes": [
              {
                "groups": [],
                "limitedAccess": false,
                "nodes": [
                  {"limitedAccess": false, "nodes": [], "text": "Reports", "folderType": "PD"},
                  {"limitedAccess": false, "nodes": [], "text": "Planning Deliverables", "folderType": "PD"}
                ],
                "text": "Planning",
                "folderType": "PD",
                "users": []
              },
              {
                "nodes": [
                  {
                    "_expanded": true,
                    "limitedAccess": false,
                    "nodes": [
                      {"limitedAccess": false, "nodes": [], "text": "Contract & PO", "folderType": "PD"},
                      {"limitedAccess": false, "nodes": [], "text": "Change Orders", "folderType": "PD"}
                    ],
                    "text": "Agreements",
                    "folderType": "PD"
                  },
                  {"limitedAccess": false, "nodes": [], "text": "Invoices", "folderType": "PD"}
                ],
                "_expanded": true,
                "groups": [
                  {"name": "Projects Managers", "role": "fileOrganizer"},
                  {"name": "Admins", "role": "organizer"}
                ],
                "limitedAccess": true,
                "text": "Commercial",
                "folderType": "PD",
                "users": []
              }
            ],
            "text": "Project Control",
            "users": []
          },
          {"limitedAccess": false, "text": "IFC Drawings"},
          {
            "limitedAccess": true,
            "groups": [
              {"name": "Technical Team", "role": "fileOrganizer"},
              {"name": "Projects Managers", "role": "fileOrganizer"}
            ],
            "text": "Engineering (EPC ONLY)",
            "users": []
          },
          {
            "groups": [
              {"name": "Projects Managers", "role": "fileOrganizer"},
              {"name": "Projects Control", "role": "fileOrganizer"}
            ],
            "limitedAccess": true,
            "nodes": [],
            "text": "Quantity Survuy",
            "folderType": "PD",
            "users": []
          },
          {"limitedAccess": false, "nodes": [], "text": "Operation", "folderType": "PD"},
          {
            "groups": [{"name": "survey team", "email": "survey-team@dtgsa.com", "role": "fileOrganizer"}],
            "limitedAccess": false,
            "nodes": [],
            "text": "Survey",
            "folderType": "PD"
          }
        ],
        "text": "Project Delivery"
      }
    ]'::jsonb,
    'system',
    true
);
