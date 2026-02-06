# Diagnostic SQL Scripts for Permission System

## Script 1: Get Current Template Structure
```sql
SELECT 
    id,
    version_number,
    template_json::text,
    created_at,
    created_by,
    is_active
FROM rfp.folder_templates
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 1;
```

**Result:**
<!-- Paste result here -->
Error: Failed to run sql query: ERROR: 42P01: relation "rfp.folder_templates" does not exist LINE 8: FROM rfp.folder_templates ^




---

## Script 2: Count Folders by Template Path
```sql
SELECT 
    template_path,
    COUNT(*) as folder_count,
    COUNT(DISTINCT project_id) as project_count
FROM rfp.folder_index
WHERE template_path IS NOT NULL
GROUP BY template_path
ORDER BY folder_count DESC;
```

**Result:**
<!-- Paste result here -->

[
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/1-PRJ-001-PD-Forms",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/2-PRJ-001-PD-MDR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/1-PRJ-001-PD-Construction",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/2-PRJ-001-PD-EHS",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/3-PRJ-001-PD-Minutes of Meetings",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/4-PRJ-001-PD-Procurment",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/5-PRJ-001-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/6-PRJ-001-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/7-PRJ-001-PD-Letters",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/1-PRJ-001-PD-Ongoing/8-PRJ-001-PD-SI & CCCOR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/1-PRJ-001-PD-Construction",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/2-PRJ-001-PD-EHS",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/3-PRJ-001-PD-Minutes of Meetings",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/4-PRJ-001-PD-Procurment",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/5-PRJ-001-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/6-PRJ-001-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/7-PRJ-001-PD-Letters",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/3-PRJ-001-PD-Submittals/2-PRJ-001-PD-Received/8-PRJ-001-PD-SI & CCCOR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/4-PRJ-001-PD-Transmittals",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/4-PRJ-001-PD-Transmittals/1-PRJ-001-PD-Received",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/1-PRJ-001-PD-Document Control/4-PRJ-001-PD-Transmittals/2-PRJ-001-PD-Sent",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBAIL%20EX%20DATA",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBAIL%20EX%20DATA/00",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBAIL%20TSF",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBAIL%20TSF/00",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBAIL%20TSF/01",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBB%20TSF",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/2-PRJ-001-PD-Quality Control/AP-TSF FLUKE TEST/projects/2468776/AP%20JUBB%20TSF/00",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/3-PRJ-001-PD-HSE",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/1-PRJ-001-PD-Planning",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/1-PRJ-001-PD-Planning/1-PRJ-001-PD-Reports",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/1-PRJ-001-PD-Planning/2-PRJ-001-PD-Planning Deliverables",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial/1-PRJ-001-PD-Agreements",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial/1-PRJ-001-PD-Agreements/1-PRJ-001-PD-Contract & PO",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial/1-PRJ-001-PD-Agreements/1-PRJ-001-PD-Contract & PO/Agremant",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial/1-PRJ-001-PD-Agreements/2-PRJ-001-PD-Change Orders",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/4-PRJ-001-PD-Project Control/2-PRJ-001-PD-Commercial/2-PRJ-001-PD-Invoices",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/5-PRJ-001-PD-IFC Drawings",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/6-PRJ-001-PD-Engineering (EPC ONLY)",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/7-PRJ-001-PD-Quantity Survuy",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/8-PRJ-001-PD-Operation",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD/9-PRJ-001-PD-Survey",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/1-PRJ-001-RFP-SOW",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/2-PRJ-001-RFP-Technical Propsal",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/2-PRJ-001-RFP-Technical Propsal/1-PRJ-001-RFP-TBE",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/2-PRJ-001-RFP-Technical Propsal/2-PRJ-001-RFP-Technical Proposal",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/3-PRJ-001-RFP-Vendors Quotations",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/3-PRJ-001-RFP-Vendors Quotations/1-PRJ-001-RFP-Civil and Finishes",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/3-PRJ-001-RFP-Vendors Quotations/2-PRJ-001-RFP-Mechanical",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/3-PRJ-001-RFP-Vendors Quotations/3-PRJ-001-RFP-E&I",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/3-PRJ-001-RFP-Vendors Quotations/4-PRJ-001-RFP-IT",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-RFP/4-PRJ-001-RFP-Commercial Propsal",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/1-PRJ-002-PD-Forms",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/2-PRJ-002-PD-MDR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/1-PRJ-002-PD-Construction",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/2-PRJ-002-PD-EHS",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/3-PRJ-002-PD-Minutes of Meetings",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/4-PRJ-002-PD-Procurment",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/5-PRJ-002-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/6-PRJ-002-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/7-PRJ-002-PD-Letters",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/1-PRJ-002-PD-Ongoing/8-PRJ-002-PD-SI & CCCOR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/1-PRJ-002-PD-Construction",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/2-PRJ-002-PD-EHS",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/3-PRJ-002-PD-Minutes of Meetings",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/4-PRJ-002-PD-Procurment",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/5-PRJ-002-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/6-PRJ-002-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/7-PRJ-002-PD-Letters",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/3-PRJ-002-PD-Submittals/2-PRJ-002-PD-Received/8-PRJ-002-PD-SI & CCCOR",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/4-PRJ-002-PD-Transmittals",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/4-PRJ-002-PD-Transmittals/1-PRJ-002-PD-Received",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/1-PRJ-002-PD-Document Control/4-PRJ-002-PD-Transmittals/2-PRJ-002-PD-Sent",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/2-PRJ-002-PD-Quality Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/3-PRJ-002-PD-HSE",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/1-PRJ-002-PD-Planning",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/1-PRJ-002-PD-Planning/1-PRJ-002-PD-Reports",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/1-PRJ-002-PD-Planning/2-PRJ-002-PD-Planning Deliverables",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/2-PRJ-002-PD-Commercial",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/2-PRJ-002-PD-Commercial/1-PRJ-002-PD-Agreements",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/2-PRJ-002-PD-Commercial/1-PRJ-002-PD-Agreements/1-PRJ-002-PD-Contract & PO",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-002-PD/4-PRJ-002-PD-Project Control/2-PRJ-002-PD-Commercial/1-PRJ-002-PD-Agreements/2-PRJ-002-PD-Change Orders",
    "folder_count": 1,
    "project_count": 1
  },
  {
    "template_path": "PRJ-001-PD",
    "folder_count": 1,
    "project_count": 1
  }
]
---

## Script 3: Sample Folder Permissions (First 10 Bidding/SOW folders)
```sql
SELECT 
    fi.id,
    fi.project_id,
    p.name as project_name,
    fi.template_path,
    fi.drive_folder_id,
    fi.limited_access_enabled
FROM rfp.folder_index fi
LEFT JOIN rfp.projects p ON p.id = fi.project_id
WHERE fi.template_path = 'Bidding/SOW'
LIMIT 10;
```

**Result:**
<!-- Paste result here -->

Success. No rows returned



---

## Script 4: All Available Groups
```sql
SELECT 
    id,
    email,
    name,
    description
FROM rfp.user_groups
ORDER BY name;
```

**Result:**
<!-- Paste result here -->

Error: Failed to run sql query: ERROR: 42P01: relation "rfp.user_groups" does not exist LINE 6: FROM rfp.user_groups ^

Note: A limit of 100 was applied to your query. If this was the cause of a syntax error, try selecting "No limit" instead and re-run the query.
---

## Script 5: Check if folder_templates table exists
```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'rfp' 
    AND table_name = 'folder_templates'
) as template_table_exists;
```

**Result:**
<!-- Paste result here -->
[
  {
    "template_table_exists": false
  }
]

---

## Script 6: Total Folders Count
```sql
SELECT 
    COUNT(*) as total_folders,
    COUNT(DISTINCT project_id) as total_projects,
    COUNT(CASE WHEN limited_access_enabled THEN 1 END) as limited_access_count
FROM rfp.folder_index;
```

**Result:**
<!-- Paste result here -->
[
  {
    "total_folders": 1010,
    "total_projects": 20,
    "limited_access_count": 0
  }
]