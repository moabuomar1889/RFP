-- Q5: See ACTUAL keys in template JSON nodes
SELECT jsonb_object_keys(
    jsonb_array_elements(
        CASE 
            WHEN jsonb_typeof(template_json) = 'array' THEN template_json
            ELSE template_json->'template'
        END
    )
) as node_keys
FROM rfp.folder_templates WHERE is_active = true;


[
  {
    "node_keys": "name"
  },
  {
    "node_keys": "children"
  },
  {
    "node_keys": "limitedAccess"
  },
  {
    "node_keys": "name"
  },
  {
    "node_keys": "children"
  },
  {
    "node_keys": "limitedAccess"
  }
]


-- Q6: See raw first-level element (just first 2 elements)
SELECT 
    elem ->> 'text' as text_val,
    elem ->> 'name' as name_val,
    elem ->> 'label' as label_val,
    jsonb_object_keys(elem) as all_keys
FROM rfp.folder_templates,
jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(template_json) = 'array' THEN template_json
        ELSE template_json->'template'
    END
) as elem
WHERE is_active = true;


[
  {
    "text_val": null,
    "name_val": "Project Delivery",
    "label_val": null,
    "all_keys": "name"
  },
  {
    "text_val": null,
    "name_val": "Project Delivery",
    "label_val": null,
    "all_keys": "children"
  },
  {
    "text_val": null,
    "name_val": "Project Delivery",
    "label_val": null,
    "all_keys": "limitedAccess"
  },
  {
    "text_val": null,
    "name_val": "Bidding",
    "label_val": null,
    "all_keys": "name"
  },
  {
    "text_val": null,
    "name_val": "Bidding",
    "label_val": null,
    "all_keys": "children"
  },
  {
    "text_val": null,
    "name_val": "Bidding",
    "label_val": null,
    "all_keys": "limitedAccess"
  }
]


-- Q7: See first child of first top-level element
SELECT 
    child ->> 'text' as text_val,
    child ->> 'name' as name_val,
    jsonb_object_keys(child) as all_keys
FROM rfp.folder_templates,
jsonb_array_elements(
    CASE 
        WHEN jsonb_typeof(template_json) = 'array' THEN template_json
        ELSE template_json->'template'
    END
) WITH ORDINALITY as t(elem, idx),
jsonb_array_elements(elem -> 'children') WITH ORDINALITY as c(child, cidx)
WHERE is_active = true AND idx = 1 AND cidx <= 2;


[
  {
    "text_val": null,
    "name_val": "Quantity Survey",
    "all_keys": "name"
  },
  {
    "text_val": null,
    "name_val": "Quantity Survey",
    "all_keys": "groups"
  },
  {
    "text_val": null,
    "name_val": "Quantity Survey",
    "all_keys": "limitedAccess"
  },
  {
    "text_val": null,
    "name_val": "Engineering (EPC ONLY)",
    "all_keys": "name"
  },
  {
    "text_val": null,
    "name_val": "Engineering (EPC ONLY)",
    "all_keys": "groups"
  },
  {
    "text_val": null,
    "name_val": "Engineering (EPC ONLY)",
    "all_keys": "limitedAccess"
  }
]


-- Q8: Count stale entries (null normalized) for PRJ-020
SELECT COUNT(*) as stale_count
FROM rfp.folder_index 
WHERE project_id = (SELECT id FROM rfp.projects WHERE pr_number = 'PRJ-020')
AND normalized_template_path IS NULL;


[
  {
    "stale_count": 7
  }
]