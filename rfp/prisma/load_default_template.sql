-- Load default template into folder_templates (the active table)
-- Run this in Supabase SQL Editor

-- Clear existing
DELETE FROM rfp.folder_templates;

-- Insert the correct default template
INSERT INTO rfp.folder_templates (version_number, template_json, created_by, is_active)
VALUES (
    1,
    '[
  {
    "name": "Project Delivery",
    "groups": [
      {
        "role": "reader",
        "email": "technical-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "dc-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "survey-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "projects-control@dtgsa.com"
      },
      {
        "role": "organizer",
        "email": "admin@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "quality-control@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "projects-managers@dtgsa.com"
      }
    ],
    "children": [
      {
        "name": "Quantity Survey",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Engineering (EPC ONLY)",
        "groups": [
          {
            "role": "fileOrganizer",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Project Control",
        "groups": [
          {
            "role": "fileOrganizer",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          },
          {
            "email": "projects-control@dtgsa.com",
            "role": "writer"
          }
        ],
        "children": [
          {
            "name": "Commercial",
            "groups": [
              {
                "role": "reader",
                "email": "projects-control@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "children": [
              {
                "name": "Invoices",
                "groups": [
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "limitedAccess": true
              },
              {
                "name": "Agreements",
                "groups": [
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "children": [
                  {
                    "name": "Change Orders",
                    "groups": [
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Contract & PO",
                    "groups": [
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  }
                ],
                "limitedAccess": true
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "Planning",
            "groups": [
              {
                "role": "fileOrganizer",
                "email": "projects-control@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              }
            ],
            "children": [
              {
                "name": "Planning Deliverables",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "projects-control@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  }
                ],
                "limitedAccess": true
              },
              {
                "name": "Reports",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "projects-control@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  }
                ],
                "limitedAccess": true
              }
            ],
            "limitedAccess": true,
            "users": [
              {
                "email": "a.albaz@dtgsa.com",
                "role": "writer"
              }
            ]
          }
        ],
        "limitedAccess": true
      },
      {
        "name": "Quality Control",
        "groups": [
          {
            "role": "fileOrganizer",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          },
          {
            "email": "quality-control@dtgsa.com",
            "role": "writer"
          }
        ],
        "limitedAccess": true,
        "users": [
          {
            "email": "a.albaz@dtgsa.com",
            "role": "writer"
          }
        ]
      },
      {
        "name": "Document Control",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "children": [
          {
            "name": "MDR",
            "groups": [
              {
                "role": "reader",
                "email": "dc-team@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "reader",
                "email": "projects-managers@dtgsa.com"
              },
              {
                "email": "quality-control@dtgsa.com",
                "role": "writer"
              },
              {
                "email": "projects-control@dtgsa.com",
                "role": "writer"
              }
            ],
            "limitedAccess": true,
            "users": [
              {
                "email": "a.albaz@dtgsa.com",
                "role": "writer"
              }
            ]
          },
          {
            "name": "Forms",
            "groups": [
              {
                "role": "reader",
                "email": "dc-team@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "reader",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "Transmittals",
            "groups": [
              {
                "role": "fileOrganizer",
                "email": "dc-team@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "children": [
              {
                "name": "Sent",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "dc-team@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "limitedAccess": true
              },
              {
                "name": "Received",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "dc-team@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "limitedAccess": true
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "Submittals",
            "groups": [
              {
                "role": "fileOrganizer",
                "email": "dc-team@dtgsa.com"
              },
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "children": [
              {
                "name": "Received",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "dc-team@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "children": [
                  {
                    "name": "SI & CCCOR",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "projects-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Letters",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Quality Control",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "quality-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true,
                    "users": [
                      {
                        "email": "a.albaz@dtgsa.com",
                        "role": "writer"
                      }
                    ]
                  },
                  {
                    "name": "Project Control",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "projects-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Procurement",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Minutes of Meetings",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "EHS",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "hse-team@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Construction",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "operation-team@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  }
                ],
                "limitedAccess": true
              },
              {
                "name": "Ongoing",
                "groups": [
                  {
                    "role": "fileOrganizer",
                    "email": "dc-team@dtgsa.com"
                  },
                  {
                    "role": "organizer",
                    "email": "admin@dtgsa.com"
                  },
                  {
                    "role": "fileOrganizer",
                    "email": "projects-managers@dtgsa.com"
                  }
                ],
                "children": [
                  {
                    "name": "SI & CCCOR",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "projects-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Letters",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Quality Control",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "quality-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true,
                    "users": [
                      {
                        "email": "a.albaz@dtgsa.com",
                        "role": "writer"
                      }
                    ]
                  },
                  {
                    "name": "Project Control",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "projects-control@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Procurement",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Minutes of Meetings",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "EHS",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "hse-team@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  },
                  {
                    "name": "Construction",
                    "groups": [
                      {
                        "role": "fileOrganizer",
                        "email": "dc-team@dtgsa.com"
                      },
                      {
                        "role": "organizer",
                        "email": "admin@dtgsa.com"
                      },
                      {
                        "role": "fileOrganizer",
                        "email": "projects-managers@dtgsa.com"
                      },
                      {
                        "email": "operation-team@dtgsa.com",
                        "role": "writer"
                      }
                    ],
                    "limitedAccess": true
                  }
                ],
                "limitedAccess": true
              }
            ],
            "limitedAccess": true
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Survey",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Operation",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "IFC Drawings",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "HSE",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "dc-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "survey-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "quality-control@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-managers@dtgsa.com"
          },
          {
            "email": "hse-team@dtgsa.com",
            "role": "writer"
          }
        ],
        "limitedAccess": false
      }
    ],
    "limitedAccess": false
  },
  {
    "name": "Bidding",
    "groups": [
      {
        "role": "reader",
        "email": "technical-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "dc-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "survey-team@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "projects-control@dtgsa.com"
      },
      {
        "role": "organizer",
        "email": "admin@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "quality-control@dtgsa.com"
      },
      {
        "role": "reader",
        "email": "projects-managers@dtgsa.com"
      }
    ],
    "children": [
      {
        "name": "Commercial Proposal",
        "groups": [
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "writer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "children": [
          {
            "name": "Admin Only",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              }
            ],
            "limitedAccess": true,
            "users": [
              {
                "email": "mo.abuomar@dtgsa.com",
                "role": "writer"
              }
            ]
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Vendors Quotations",
        "groups": [
          {
            "role": "reader",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "reader",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "fileOrganizer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "children": [
          {
            "name": "Civil and Finishes",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "IT",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "E&I",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          },
          {
            "name": "Mechanical",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "fileOrganizer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          }
        ],
        "limitedAccess": false
      },
      {
        "name": "Technical Proposal",
        "groups": [
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "writer",
            "email": "projects-managers@dtgsa.com"
          },
          {
            "email": "projects-control@dtgsa.com",
            "role": "writer"
          }
        ],
        "children": [
          {
            "name": "TBE",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "writer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true,
            "users": [
              {
                "email": "Marwan@dtgsa.com",
                "role": "writer"
              }
            ]
          },
          {
            "name": "Technical Proposal",
            "groups": [
              {
                "role": "organizer",
                "email": "admin@dtgsa.com"
              },
              {
                "role": "writer",
                "email": "projects-managers@dtgsa.com"
              }
            ],
            "limitedAccess": true
          }
        ],
        "limitedAccess": false,
        "users": [
          {
            "email": "a.albaz@dtgsa.com",
            "role": "writer"
          },
          {
            "email": "abed.ahmad@dtgsa.com",
            "role": "writer"
          },
          {
            "email": "Waseem@dtgsa.com",
            "role": "writer"
          }
        ]
      },
      {
        "name": "SOW",
        "groups": [
          {
            "role": "writer",
            "email": "technical-team@dtgsa.com"
          },
          {
            "role": "writer",
            "email": "projects-control@dtgsa.com"
          },
          {
            "role": "organizer",
            "email": "admin@dtgsa.com"
          },
          {
            "role": "writer",
            "email": "projects-managers@dtgsa.com"
          }
        ],
        "limitedAccess": true,
        "users": [
          {
            "email": "abed.ahmad@dtgsa.com",
            "role": "writer"
          },
          {
            "email": "Waseem@dtgsa.com",
            "role": "writer"
          }
        ]
      }
    ],
    "limitedAccess": false
  }
]'::jsonb,
    'system',
    true
);

-- Verify
SELECT version_number, created_by, is_active, created_at,
       jsonb_array_length(template_json) as phase_count
FROM rfp.folder_templates;
