#!/bin/bash
# ============================================================
# Google Drive Folder Structure & Permissions Extractor
# For use with GAM in Google Cloud Shell (Bash)
# ============================================================

# TARGET FOLDER
FOLDER_ID="1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd"
FOLDER_NAME="PRJ-014-Steam Turbine Generator"
OUTPUT_DIR="./drive_export"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "========================================"
echo "  Google Drive Folder Extractor"
echo "========================================"
echo ""
echo "Target Folder: $FOLDER_NAME"
echo "Folder ID:     $FOLDER_ID"
echo "Output Dir:    $OUTPUT_DIR"
echo ""

# ============================================================
# STEP 1: Get root folder info
# ============================================================
echo "📁 Getting root folder info..."
gam user me show fileinfo "$FOLDER_ID" > "$OUTPUT_DIR/root_info.txt" 2>&1
echo "✅ Saved to root_info.txt"

# ============================================================
# STEP 2: Get permissions for root folder
# ============================================================
echo "🔐 Getting root folder permissions..."
gam user me show drivefileacl "$FOLDER_ID" > "$OUTPUT_DIR/root_permissions.txt" 2>&1
echo "✅ Saved to root_permissions.txt"

# ============================================================
# STEP 3: List ALL subfolders (Level 1)
# ============================================================
echo "📂 Listing level 1 subfolders..."
gam user me print filelist query "'$FOLDER_ID' in parents and mimeType = 'application/vnd.google-apps.folder'" fields id,name > "$OUTPUT_DIR/subfolders_level1.csv" 2>&1
echo "✅ Saved to subfolders_level1.csv"

# ============================================================
# STEP 4: Get ALL subfolders with permissions
# ============================================================
echo "🔐 Getting all subfolders with permissions..."
gam user me print filelist query "'$FOLDER_ID' in parents and mimeType = 'application/vnd.google-apps.folder'" showpermission > "$OUTPUT_DIR/subfolders_with_permissions.csv" 2>&1
echo "✅ Saved to subfolders_with_permissions.csv"

# ============================================================
# STEP 5: Process each subfolder (extract structure recursively)
# ============================================================
echo ""
echo "📊 Processing subfolders for detailed permissions..."
echo ""

# Read subfolder IDs and process each
while IFS=, read -r owner id name mimetype; do
    # Skip header line
    if [[ "$id" == "id" ]] || [[ "$owner" == "Owner" ]]; then
        continue
    fi
    
    # Clean up name (remove quotes)
    clean_name=$(echo "$name" | tr -d '"')
    clean_id=$(echo "$id" | tr -d '"')
    
    if [[ -n "$clean_id" ]] && [[ "$clean_id" != "id" ]]; then
        echo "  📁 $clean_name"
        
        # Get permissions for this folder
        gam user me show drivefileacl "$clean_id" > "$OUTPUT_DIR/perm_${clean_name//[^a-zA-Z0-9]/_}.txt" 2>&1
        
        # Get children of this folder
        gam user me print filelist query "'$clean_id' in parents and mimeType = 'application/vnd.google-apps.folder'" fields id,name >> "$OUTPUT_DIR/all_subfolders.csv" 2>&1
    fi
done < "$OUTPUT_DIR/subfolders_level1.csv"

echo ""
echo "========================================"
echo "  Extraction Complete!"
echo "========================================"
echo ""
echo "Files created in $OUTPUT_DIR:"
ls -la "$OUTPUT_DIR"
echo ""
echo "Next steps:"
echo "  1. Review the CSV and TXT files"
echo "  2. Copy the structure to your RFP template"
echo "  3. Map groups to your RFP system groups"
echo ""
