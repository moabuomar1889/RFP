# ============================================================
# GAM COMMANDS FOR GOOGLE DRIVE FOLDER EXTRACTION
# ============================================================
# Run these commands individually in PowerShell/Terminal
# Make sure GAM is installed and authenticated
# ============================================================

# TARGET FOLDER INFO
# Folder ID: 1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd
# Folder Name: PRJ-014-Steam Turbine Generator

# ============================================================
# STEP 1: Get root folder info
# ============================================================
gam user me show fileinfo 1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd

# ============================================================
# STEP 2: Get permissions for root folder
# ============================================================
gam user me show drivefileacl 1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd

# ============================================================
# STEP 3: List ALL files and folders recursively
# This exports to CSV
# ============================================================
gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents or '1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in ancestors" fields id,name,mimeType,parents todrive

# OR save to local file:
gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents" fields id,name,mimeType,parents > drive_export\children_level1.csv

# ============================================================
# STEP 4: Get permissions for ALL files/folders
# This is the most comprehensive export
# ============================================================
gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents" showpermission > drive_export\permissions_level1.csv

# ============================================================
# STEP 5: List direct children with permissions (one command)
# ============================================================
gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents and mimeType = 'application/vnd.google-apps.folder'" showpermission

# ============================================================
# INDIVIDUAL FOLDER PERMISSION CHECKS
# Replace FOLDER_ID with each subfolder ID
# ============================================================

# To get a folder's ACL:
# gam user me show drivefileacl FOLDER_ID

# To print permissions in detail:
# gam user me print drivefileacl FOLDER_ID

# ============================================================
# BATCH SCRIPT - Run this to extract children of known folders
# ============================================================

# First, get list of all subfolders
# gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents and mimeType = 'application/vnd.google-apps.folder'" fields id,name > subfolders.csv

# Then get permissions for each (manual or loop)

# ============================================================
# USEFUL GAM QUERIES FOR FOLDER ANALYSIS
# ============================================================

# Find all folders with "Limited" or restricted sharing:
# gam user me print filelist query "mimeType = 'application/vnd.google-apps.folder' and '1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents" showpermission

# Find folders shared with specific group:
# gam user me print filelist query "'1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd' in parents" showpermission | findstr "projects.managers@dtgsa.com"

# ============================================================
# EXPECTED OUTPUT STRUCTURE
# ============================================================
# After running these commands, you should have:
# 1. List of all subfolders with IDs
# 2. Permissions for each folder
# 3. Group/user assignments
#
# This data can then be used to:
# - Update your RFP template
# - Verify permissions consistency
# - Create new projects with same structure
# ============================================================
