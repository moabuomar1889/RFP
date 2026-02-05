# Google Drive Folder Structure & Permissions Extractor
# Uses GAM to recursively extract folder structure and permissions
# Target: PRJ-014-Steam Turbine Generator (1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd)

param(
    [string]$FolderId = "1ZbPwtSJigwlyvpv7nJaq6g5WYSiUCIPd",
    [string]$FolderName = "PRJ-014-Steam Turbine Generator",
    [string]$OutputDir = ".\drive_export"
)

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Google Drive Folder Extractor" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Target Folder: $FolderName" -ForegroundColor Yellow
Write-Host "Folder ID:     $FolderId" -ForegroundColor Yellow
Write-Host "Output Dir:    $OutputDir" -ForegroundColor Yellow
Write-Host ""

# Initialize output files
$folderStructureFile = "$OutputDir\folder_structure.json"
$permissionsFile = "$OutputDir\folder_permissions.json"
$templateFile = "$OutputDir\template_import.json"
$reportFile = "$OutputDir\permissions_report.txt"

# Function to get folder info using GAM
function Get-DriveFolder {
    param([string]$Id)
    
    try {
        $result = gam user me show fileinfo $Id fields id,name,mimeType,parents 2>&1
        if ($LASTEXITCODE -eq 0) {
            $info = @{}
            foreach ($line in $result) {
                if ($line -match "^\s*(\w+):\s*(.+)$") {
                    $info[$matches[1]] = $matches[2].Trim()
                }
            }
            return $info
        }
    } catch {
        Write-Warning "Error getting folder info for $Id: $_"
    }
    return $null
}

# Function to list children of a folder
function Get-DriveChildren {
    param([string]$ParentId)
    
    $children = @()
    try {
        # List all items in folder - only folders (mimeType = folder)
        $result = gam user me print filelist query "'$ParentId' in parents and mimeType = 'application/vnd.google-apps.folder'" fields id,name,mimeType 2>&1
        
        # Parse CSV output
        $lines = $result -split "`n" | Where-Object { $_ -match "," -and $_ -notmatch "^Owner" }
        foreach ($line in $lines) {
            if ($line -match '"([^"]+)","([^"]+)","([^"]+)"' -or $line -match '([^,]+),([^,]+),(.+)') {
                $child = @{
                    id = $matches[1]
                    name = $matches[2]
                    mimeType = $matches[3]
                }
                if ($child.id -ne "Owner" -and $child.id -ne "id") {
                    $children += $child
                }
            }
        }
    } catch {
        Write-Warning "Error listing children of $ParentId: $_"
    }
    
    return $children
}

# Function to get permissions for a folder
function Get-DrivePermissions {
    param([string]$FileId)
    
    $permissions = @()
    try {
        $result = gam user me print filelist id:$FileId showpermission 2>&1
        
        # Parse permission lines
        foreach ($line in $result) {
            if ($line -match "role:\s*(\w+)" -and $line -match "emailAddress:\s*([^\s,]+)") {
                $perm = @{
                    role = $matches[1]
                    email = $matches[2]
                    type = if ($line -match "type:\s*(\w+)") { $matches[1] } else { "user" }
                }
                $permissions += $perm
            }
        }
        
        # Alternative: Use show drivefileacl
        if ($permissions.Count -eq 0) {
            $result = gam user me show drivefileacl $FileId 2>&1
            foreach ($line in $result) {
                if ($line -match "emailAddress:\s*(.+)$") {
                    $email = $matches[1].Trim()
                    $role = "reader"
                    if ($line -match "role:\s*(\w+)") { $role = $matches[1] }
                    $permissions += @{ email = $email; role = $role; type = "user" }
                }
            }
        }
    } catch {
        Write-Warning "Error getting permissions for $FileId: $_"
    }
    
    return $permissions
}

# Recursive function to build folder tree
function Build-FolderTree {
    param(
        [string]$FolderId,
        [string]$FolderName,
        [string]$Path = "",
        [int]$Depth = 0
    )
    
    $indent = "  " * $Depth
    Write-Host "${indent}📁 $FolderName" -ForegroundColor White
    
    # Get permissions for this folder
    Write-Host "${indent}   Getting permissions..." -ForegroundColor DarkGray
    $permissions = Get-DrivePermissions -FileId $FolderId
    
    # Determine if limited access
    $limitedAccess = $permissions.Count -gt 0 -and $permissions.Count -lt 20  # Heuristic
    
    # Build groups array from permissions
    $groups = @()
    $users = @()
    foreach ($perm in $permissions) {
        if ($perm.email -match "@.*\.com$|@.*\.co$") {
            if ($perm.email -match "group|admins|managers|team") {
                $groups += @{
                    name = ($perm.email -split "@")[0]
                    email = $perm.email
                    role = $perm.role
                }
            } else {
                $users += @{
                    email = $perm.email
                    role = $perm.role
                }
            }
        }
    }
    
    # Get children
    $children = Get-DriveChildren -ParentId $FolderId
    $childNodes = @()
    
    foreach ($child in $children) {
        $childPath = if ($Path) { "$Path/$($child.name)" } else { $child.name }
        $childNode = Build-FolderTree -FolderId $child.id -FolderName $child.name -Path $childPath -Depth ($Depth + 1)
        $childNodes += $childNode
    }
    
    # Build node object
    $node = @{
        text = $FolderName
        name = $FolderName
        driveId = $FolderId
        path = if ($Path) { $Path } else { $FolderName }
        limitedAccess = $limitedAccess
        groups = $groups
        users = $users
        permissions = $permissions
        nodes = $childNodes
        children = $childNodes
    }
    
    return $node
}

# Main execution
Write-Host ""
Write-Host "Starting extraction..." -ForegroundColor Green
Write-Host ""

# Build the complete folder tree
$tree = Build-FolderTree -FolderId $FolderId -FolderName $FolderName

# Save full structure with permissions
$tree | ConvertTo-Json -Depth 20 | Out-File $folderStructureFile -Encoding UTF8
Write-Host ""
Write-Host "✅ Full structure saved to: $folderStructureFile" -ForegroundColor Green

# Create template-compatible format (without drive IDs)
function Convert-ToTemplate {
    param($Node)
    
    $templateNode = @{
        text = $Node.text
        limitedAccess = $Node.limitedAccess
    }
    
    if ($Node.groups -and $Node.groups.Count -gt 0) {
        $templateNode.groups = $Node.groups | ForEach-Object {
            @{
                name = $_.name
                role = $_.role
            }
        }
    }
    
    if ($Node.users -and $Node.users.Count -gt 0) {
        $templateNode.users = $Node.users
    }
    
    if ($Node.nodes -and $Node.nodes.Count -gt 0) {
        $templateNode.nodes = @()
        foreach ($child in $Node.nodes) {
            $templateNode.nodes += Convert-ToTemplate -Node $child
        }
    }
    
    return $templateNode
}

$templateFormat = @(Convert-ToTemplate -Node $tree)
$templateFormat | ConvertTo-Json -Depth 20 | Out-File $templateFile -Encoding UTF8
Write-Host "✅ Template format saved to: $templateFile" -ForegroundColor Green

# Generate human-readable report
$report = @"
========================================
FOLDER STRUCTURE & PERMISSIONS REPORT
========================================
Project: $FolderName
Folder ID: $FolderId
Generated: $(Get-Date)
========================================

"@

function Write-FolderReport {
    param($Node, [int]$Indent = 0)
    
    $prefix = "  " * $Indent
    $output = "${prefix}📁 $($Node.text)`n"
    $output += "${prefix}   ID: $($Node.driveId)`n"
    $output += "${prefix}   Limited Access: $($Node.limitedAccess)`n"
    
    if ($Node.permissions -and $Node.permissions.Count -gt 0) {
        $output += "${prefix}   Permissions:`n"
        foreach ($perm in $Node.permissions) {
            $output += "${prefix}     - $($perm.email): $($perm.role)`n"
        }
    }
    
    $output += "`n"
    
    if ($Node.nodes) {
        foreach ($child in $Node.nodes) {
            $output += Write-FolderReport -Node $child -Indent ($Indent + 1)
        }
    }
    
    return $output
}

$report += Write-FolderReport -Node $tree
$report | Out-File $reportFile -Encoding UTF8
Write-Host "✅ Report saved to: $reportFile" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Extraction Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files created:" -ForegroundColor Yellow
Write-Host "  1. folder_structure.json  - Full structure with Drive IDs" -ForegroundColor White
Write-Host "  2. template_import.json   - Ready to import into RFP template" -ForegroundColor White
Write-Host "  3. permissions_report.txt - Human-readable report" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review template_import.json" -ForegroundColor White
Write-Host "  2. Adjust group names to match your RFP system groups" -ForegroundColor White
Write-Host "  3. Import via RFP Template page or API" -ForegroundColor White
Write-Host ""
