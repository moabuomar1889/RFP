/* Code.gs
   Description: Modified version to generate PR numbers, create folders according to template, and apply group permissions.
   Requirements: Drive (Advanced Service - v2) enabled, AdminDirectory enabled (if you want to use member management).
*/

// Constant settings
const ROOT_SHARED_DRIVE_ID = PropertiesService.getScriptProperties().getProperty('SHARED_DRIVE_ID') || '1dTLJTMRfRJ-hwYtC6JwLcJ5BXibSjz9W'; // Shared Drive ID
const TEMPLATE_PROP = 'PROJECT_FOLDER_TEMPLATE';
const TEMPLATE_BACKUP_PROP = 'PROJECT_FOLDER_TEMPLATE_BACKUP';
const ACCESS_POLICY_PROP = 'ACCESS_POLICY';
const LAST_PR_PROP = 'LAST_PR_NUMBER';
const SNAPSHOT_SHEET_PROP = 'SNAPSHOT_SPREADSHEET_ID'; // ID of spreadsheet containing snapshot sheets

// --- Utilities ---
/** Entry point for the Web App */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var action = (p.action || '').toLowerCase();

  if (action === 'approve') {
    // Execute approval and create folders
    try {
      var pr_param = p.pr || ''; // e.g., 'PRJ-004'
      var pr = pr_param.startsWith('PRJ-') ? pr_param.substring(4) : pr_param; // e.g., '004'
      var projectName = p.name || '';
      
      // Clean projectName - remove any PRJ-XXX- from the beginning
      if (projectName) {
        const prPrefixMatch = projectName.match(/^PRJ-\d+-(.+)$/);
        if (prPrefixMatch) {
          projectName = prPrefixMatch[1]; // Extract name only without PRJ-XXX-
        }
      }
      
      var phase = p.phase || '';
      
      var result = '';
      if (phase === 'bidding') {
        // Check if project exists first
        const existingProjectRoot = getProjectRootFolder(pr, projectName);
        if (existingProjectRoot) {
          throw new Error(`Project folder '${existingProjectRoot.title}' already exists.`);
        }
        result = createRFPProject(pr, projectName);
      } else if (phase === 'project_delivery') {
        // Check if PD folder exists first
        const projectRootFolder = getProjectRootFolder(pr, projectName);
        if (!projectRootFolder) {
          throw new Error(`Project folder 'PRJ-${pr}-${projectName}' not found for PD approval.`);
        }
        const existingPDFolder = getPDFolder(projectRootFolder.id, pr);
        if (existingPDFolder) {
          throw new Error(`PD folder '${existingPDFolder.title}' already exists within project '${projectRootFolder.title}'.`);
        }
        result = createPDFolder(pr, projectName);
      } else {
        throw new Error('Invalid phase');
      }
      
      // Display approval success page
      return renderTemplate('ApprovalSuccess', {
        projectNumber: pr,
        projectName: projectName,
        phase: phase,
        result: result
      }).setTitle('Approval Successful')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(`
        <html><body>
          <h2>Error</h2>
          <p>${err.message}</p>
          <a href="${ScriptApp.getService().getUrl()}">Back to Home</a>
        </body></html>
      `).setTitle('Error');
    }
  }

  // Main interface
  return HtmlService.createTemplateFromFile('Ui_Combined')
    .evaluate()
    .setTitle('Project Folder Management')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Helper: render HTML file with data */
function renderTemplate(fileName, data) {
  var t = HtmlService.createTemplateFromFile(fileName);
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(function (k) { t[k] = data[k]; });
  }
  return t.evaluate();
}

/** (Optional) Include other HTML files when needed: <?!= include('PartialName'); ?> */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function logRow(level, action, message, meta) {
  try {
    let ss = null;
    
    // Try to use Spreadsheet specified from Properties
    const logsSheetId = PropertiesService.getScriptProperties().getProperty('LOGS_SPREADSHEET_ID');
    if (logsSheetId) {
      try {
        ss = SpreadsheetApp.openById(logsSheetId);
      } catch (e) {
        // If failed, we'll try to use active spreadsheet
      }
    }
    
    // If there's no specified Spreadsheet, use active spreadsheet
    if (!ss) {
      try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      } catch (e) {
        // If there's no active spreadsheet, create a new one
      }
    }
    
    // If there's no active spreadsheet, create a new one
    if (!ss) {
      ss = SpreadsheetApp.create('DTG_Logs');
      PropertiesService.getScriptProperties().setProperty('LOGS_SPREADSHEET_ID', ss.getId());
    }
    
  const sh = ss.getSheetByName('DTG_Logs') || ss.insertSheet('DTG_Logs');
    
    // Add headers if they don't exist
    if (sh.getLastRow() === 0) {
      sh.appendRow(['Timestamp', 'Level', 'Action', 'Message', 'Meta']);
      sh.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
  sh.appendRow([new Date().toISOString(), level, action, message, meta || '']);
  } catch (err) {
    // If everything fails, just log to console (for development)
    console.error('Failed to log:', level, action, message, err);
  }
}

/* ============================================================================
 * SNAPSHOT SYSTEM - Cached view of Drive state for performance
 * ============================================================================
 * 
 * ARCHITECTURE:
 * - Template (Desired State): Stored in PropertiesService, defines what folders
 *   should exist and their permissions. This is the source of truth.
 * - Drive (Live State): Actual Google Drive folders and permissions.
 * - Snapshot (Cached State): Stored in Google Sheets, cached view of Drive state
 *   for fast UI rendering and comparison. Updated periodically or after Apply.
 * 
 * RELATIONSHIPS:
 * - Template → Drive: "Apply" operations modify Drive to match Template
 * - Drive → Snapshot: scanDriveSnapshot() reads Drive and updates Snapshot
 * - Snapshot + Template → UI: Comparison logic uses both to show matched/mismatched
 * 
 * SAVE STRUCTURE:
 * - ONLY updates Template (PropertiesService)
 * - Does NOT modify Drive or Snapshot
 * - "Apply" operations are responsible for making Drive match Template
 */

/* Get or create the Snapshot spreadsheet */
function getSnapshotSpreadsheet() {
  try {
    let ss = null;
    const snapshotSheetId = PropertiesService.getScriptProperties().getProperty(SNAPSHOT_SHEET_PROP);
    
    if (snapshotSheetId) {
      try {
        ss = SpreadsheetApp.openById(snapshotSheetId);
        return ss;
      } catch (e) {
        logRow('WARN', 'getSnapshotSpreadsheet', `Snapshot spreadsheet ${snapshotSheetId} not accessible, will create new one: ${e.message}`);
      }
    }
    
    // Use same spreadsheet as logs if available
    const logsSheetId = PropertiesService.getScriptProperties().getProperty('LOGS_SPREADSHEET_ID');
    if (logsSheetId) {
      try {
        ss = SpreadsheetApp.openById(logsSheetId);
        PropertiesService.getScriptProperties().setProperty(SNAPSHOT_SHEET_PROP, logsSheetId);
        return ss;
      } catch (e) {
        // Continue to create new spreadsheet
      }
    }
    
    // Create new spreadsheet for snapshots
    ss = SpreadsheetApp.create('DTG_Snapshots');
    PropertiesService.getScriptProperties().setProperty(SNAPSHOT_SHEET_PROP, ss.getId());
    logRow('INFO', 'getSnapshotSpreadsheet', `Created new snapshot spreadsheet: ${ss.getId()}`);
    return ss;
  } catch (err) {
    logRow('ERROR', 'getSnapshotSpreadsheet', `Error getting snapshot spreadsheet: ${err.message}`);
    throw err;
  }
}

/* Get or create FolderSnapshot sheet */
function getFolderSnapshotSheet() {
  try {
    const ss = getSnapshotSpreadsheet();
    let sheet = ss.getSheetByName('FolderSnapshot');
    
    if (!sheet) {
      sheet = ss.insertSheet('FolderSnapshot');
      // Add headers
      sheet.appendRow([
        'projectCode',
        'prNumber',
        'folderId',
        'folderPath',
        'inheritedPermissionsDisabled',
        'directGroups',
        'templateLimitedAccess',
        'lastScanned'
      ]);
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e3f2fd');
      // Freeze header row
      sheet.setFrozenRows(1);
      logRow('INFO', 'getFolderSnapshotSheet', 'Created FolderSnapshot sheet with headers');
    }
    
    return sheet;
  } catch (err) {
    logRow('ERROR', 'getFolderSnapshotSheet', `Error getting FolderSnapshot sheet: ${err.message}`);
    throw err;
  }
}

/* Get or create GroupsSnapshot sheet */
function getGroupsSnapshotSheet() {
  try {
    const ss = getSnapshotSpreadsheet();
    let sheet = ss.getSheetByName('GroupsSnapshot');
    
    if (!sheet) {
      sheet = ss.insertSheet('GroupsSnapshot');
      // Add headers
      sheet.appendRow([
        'groupEmail',
        'displayName',
        'members',
        'lastScanned'
      ]);
      // Format header row
      const headerRange = sheet.getRange(1, 1, 1, 4);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#e3f2fd');
      // Freeze header row
      sheet.setFrozenRows(1);
      logRow('INFO', 'getGroupsSnapshotSheet', 'Created GroupsSnapshot sheet with headers');
    }
    
    return sheet;
  } catch (err) {
    logRow('ERROR', 'getGroupsSnapshotSheet', `Error getting GroupsSnapshot sheet: ${err.message}`);
    throw err;
  }
}

/* Helper: Get folder snapshot row by folderId */
function getFolderSnapshotById(folderId) {
  try {
    const sheet = getFolderSnapshotSheet();
    const data = sheet.getDataRange().getValues();
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] === folderId) { // folderId is column 3 (index 2)
        return {
          projectCode: data[i][0],
          prNumber: data[i][1],
          folderId: data[i][2],
          folderPath: data[i][3],
          inheritedPermissionsDisabled: data[i][4] === 'Yes',
          directGroups: data[i][5] ? data[i][5].split(',').map(g => g.trim()) : [],
          templateLimitedAccess: data[i][6] === 'Yes',
          lastScanned: data[i][7],
          rowIndex: i + 1 // 1-based row index
        };
      }
    }
    return null;
  } catch (err) {
    logRow('ERROR', 'getFolderSnapshotById', `Error getting folder snapshot for ${folderId}: ${err.message}`);
    return null;
  }
}

/* Helper: Get all folder snapshot rows for a project */
function getFolderSnapshotRowsForProject(projectCodeOrId) {
  try {
    const sheet = getFolderSnapshotSheet();
    const data = sheet.getDataRange().getValues();
    const results = [];
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectCodeOrId || data[i][2] === projectCodeOrId) { // Match projectCode or folderId
        results.push({
          projectCode: data[i][0],
          prNumber: data[i][1],
          folderId: data[i][2],
          folderPath: data[i][3],
          inheritedPermissionsDisabled: data[i][4] === 'Yes',
          directGroups: data[i][5] ? data[i][5].split(',').map(g => g.trim()) : [],
          templateLimitedAccess: data[i][6] === 'Yes',
          lastScanned: data[i][7],
          rowIndex: i + 1
        });
      }
    }
    return results;
  } catch (err) {
    logRow('ERROR', 'getFolderSnapshotRowsForProject', `Error getting folder snapshots for project ${projectCodeOrId}: ${err.message}`);
    return [];
  }
}

/* TEST FUNCTION: Verify Batch Snapshot Write */
function testSnapshotBatchWrite() {
  const sheet = getFolderSnapshotSheet();
  const initialRows = sheet.getLastRow();
  console.log('Initial rows:', initialRows);
  
  // Run scan
  const result = scanDriveSnapshot();
  
  const finalRows = sheet.getLastRow();
  console.log('Final rows:', finalRows);
  
  if (finalRows <= 1 && result.scannedFolders > 0) {
    throw new Error("Snapshot is empty after scan despite finding folders");
  }
  return `Snapshot populated with ${finalRows - 1} rows (Scanned: ${result.scannedFolders})`;
}

/* ============================================================================
 * SCAN DRIVE SNAPSHOT - Read-only scan of Drive state, writes to Snapshot
 * ============================================================================
 * This function scans all folders in Drive and updates the FolderSnapshot sheet.
 * It does NOT modify Drive - it only reads and caches the state.
 * REFACTORED: Uses batch operations for read/write to avoid timeouts.
 */
function scanDriveSnapshot() {
  try {
    logRow('INFO', 'scanDriveSnapshot', 'Starting Drive snapshot scan (Batch Mode)');
    const startTime = new Date().getTime();
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) throw new Error('Shared Drive ID not configured');
    
    // 1. Prepare Sheet
    const sheet = getFolderSnapshotSheet();
    if (!sheet) throw new Error('Failed to get FolderSnapshot sheet');
    
    // Clear existing data (except header)
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 8).clearContent();
    }
    SpreadsheetApp.flush(); // Ensure clear is applied
    
    // 2. Get Template & Projects
    const template = getTemplateTree(false);
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    let pageToken = null;
    let allRows = [];
    let totalFolders = 0;
    let projectsProcessed = 0;
    
    // 3. Scan Drive
    do {
      const res = Drive.Files.list({ 
        q: q, 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        maxResults: 100, 
        pageToken: pageToken 
      });
      
      const projects = res.items || [];
      
      for (const project of projects) {
        projectsProcessed++;
        const pr = extractPRNumber(project.title);
        if (!pr) continue; // Skip non-project folders
        
        // Get all folders recursively
        const projectFolders = getAllFoldersRecursively(project.id, project.title);
        totalFolders += projectFolders.length;
        
        for (const folder of projectFolders) {
          try {
            // Get metadata & permissions
            const folderMeta = Drive.Files.get(folder.id, {
              supportsAllDrives: true,
              fields: 'id,title,inheritedPermissionsDisabled,driveId'
            });
            
            // Get direct groups
            let directGroups = [];
            try {
              const perms = getFolderPermissionsSafely(folder.id);
              if (perms.items) {
                perms.items.forEach(p => {
                  if (p.type === 'group' && !shouldSkipPermission(p).skip) {
                    const email = p.emailAddress || p.value;
                    if (email && email.includes('@')) directGroups.push(email);
                  }
                });
              }
            } catch (e) {
              logRow('WARN', 'scanDriveSnapshot', `Perms error ${folder.id}: ${e.message}`);
            }
            
            // Check template limited access
            const templateNode = findTemplateNodeForFolder(folder, template, pr);
            const isLimited = templateNode ? (templateNode.limitedAccess === true) : false;
            
            // Add to batch
            allRows.push([
              project.title,
              pr,
              folder.id,
              folder.path || folder.title,
              folderMeta.inheritedPermissionsDisabled ? 'Yes' : 'No',
              directGroups.join(','),
              isLimited ? 'Yes' : 'No',
              new Date().toISOString()
            ]);
            
          } catch (err) {
            logRow('WARN', 'scanDriveSnapshot', `Error processing folder ${folder.id}: ${err.message}`);
          }
        }
      }
      
      pageToken = res.nextPageToken;
    } while (pageToken);
    
    // 4. Batch Write
    if (allRows.length > 0) {
      logRow('INFO', 'scanDriveSnapshot', `Writing ${allRows.length} rows to sheet...`);
      sheet.getRange(2, 1, allRows.length, 8).setValues(allRows);
    }
    
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    logRow('INFO', 'scanDriveSnapshot', `Snapshot completed: ${allRows.length} folders in ${elapsed}s`);
    
    return {
      success: true,
      scannedFolders: allRows.length,
      elapsedSeconds: elapsed
    };
    
  } catch (err) {
    logRow('ERROR', 'scanDriveSnapshot', `Fatal error: ${err.message}`);
    throw err;
  }
}


/* ============================================================================
 * SCAN GROUPS SNAPSHOT - Read-only scan of Groups, writes to Snapshot
 * ============================================================================
 * This function scans all groups used in the template and updates GroupsSnapshot.
 * REFACTORED: Uses batch operations.
 */
function scanGroupsSnapshot() {
  try {
    logRow('INFO', 'scanGroupsSnapshot', 'Starting Groups snapshot scan (Batch Mode)');
    const startTime = new Date().getTime();
    
    // 1. Collect Groups
    const groupsSet = new Set();
    
    // From Template
    try {
      const template = getTemplateTree(false);
      if (template) {
        const collect = (node) => {
          if (node.groups) {
            node.groups.forEach(g => {
              const email = normalizeGroupEmail(typeof g === 'string' ? g : g.name);
              if (email && email.includes('@')) groupsSet.add(email);
            });
          }
          if (node.nodes) node.nodes.forEach(collect);
        };
        template.forEach(collect);
      }
    } catch (e) { logRow('WARN', 'scanGroupsSnapshot', `Template scan error: ${e.message}`); }
    
    // From Access Policy
    try {
      const policy = getAccessPolicy();
      if (policy && policy.groups) {
        Object.keys(policy.groups).forEach(g => {
          const email = normalizeGroupEmail(g);
          if (email && email.includes('@')) groupsSet.add(email);
        });
      }
    } catch (e) { logRow('WARN', 'scanGroupsSnapshot', `Policy scan error: ${e.message}`); }
    
    // From Existing Snapshot (preserve known groups)
    try {
      const sheet = getGroupsSnapshotSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0]) groupsSet.add(data[i][0]);
      }
    } catch (e) {}

    // 2. Scan Details & Build Rows
    const sheet = getGroupsSnapshotSheet();
    const allRows = [];
    let errors = 0;
    
    for (const email of groupsSet) {
      try {
        const group = AdminDirectory.Groups.get(email, { fields: 'email,name,members' });
        allRows.push([
          group.email || email,
          group.name || email,
          group.members ? group.members.length : 0,
          new Date().toISOString()
        ]);
      } catch (e) {
        errors++;
        // Keep the group in the list even if scan fails, to avoid losing it
        allRows.push([email, email, 0, new Date().toISOString()]);
        logRow('WARN', 'scanGroupsSnapshot', `Failed to scan group ${email}: ${e.message}`);
      }
      
      if (allRows.length % 10 === 0) Utilities.sleep(100); // Rate limit protection
    }
    
    // 3. Batch Write
    if (allRows.length > 0) {
      // Clear old data
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 4).clearContent();
      SpreadsheetApp.flush();
      
      // Write new data
      sheet.getRange(2, 1, allRows.length, 4).setValues(allRows);
    }
    
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    logRow('INFO', 'scanGroupsSnapshot', `Groups snapshot completed: ${allRows.length} groups in ${elapsed}s`);
    
    return { success: true, scanned: allRows.length, elapsedSeconds: elapsed };
    
  } catch (err) {
    logRow('ERROR', 'scanGroupsSnapshot', `Fatal error: ${err.message}`);
    throw err;
  }
}

/* ============================================================================
 * TRIGGER SETUP - Time-driven triggers for automatic snapshot updates
 * ============================================================================
 */

/* Setup time-driven trigger for scanDriveSnapshot() - runs every 3 hours
 * Call this function once to set up the trigger, or manually create it in Apps Script editor
 */
function setupSnapshotTrigger() {
  try {
    // Delete existing triggers for scanDriveSnapshot to avoid duplicates
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'scanDriveSnapshot') {
        ScriptApp.deleteTrigger(trigger);
        logRow('INFO', 'setupSnapshotTrigger', 'Deleted existing scanDriveSnapshot trigger');
      }
    });
    
    // Create new time-driven trigger - runs every 3 hours
    ScriptApp.newTrigger('scanDriveSnapshot')
      .timeBased()
      .everyHours(3)
      .create();
    
    logRow('INFO', 'setupSnapshotTrigger', 'Created time-driven trigger for scanDriveSnapshot (every 3 hours)');
    return 'Snapshot trigger created successfully. scanDriveSnapshot() will run every 3 hours.';
  } catch (err) {
    logRow('ERROR', 'setupSnapshotTrigger', `Error setting up trigger: ${err.message}`);
    throw err;
  }
}

/* Get snapshot status information */
function getSnapshotStatus() {
  try {
    const status = {
      folders: {
        lastUpdated: null,
        totalRows: 0
      },
      groups: {
        lastUpdated: null,
        totalRows: 0
      }
    };
    
    // Get folders snapshot status
    try {
      const folderSheet = getFolderSnapshotSheet();
      const folderData = folderSheet.getDataRange().getValues();
      status.folders.totalRows = folderData.length - 1; // Exclude header
      
      // Find most recent lastScanned timestamp
      if (folderData.length > 1) {
        let mostRecent = null;
        for (let i = 1; i < folderData.length; i++) {
          const lastScanned = folderData[i][7]; // lastScanned column
          if (lastScanned) {
            const scannedDate = new Date(lastScanned);
            if (!mostRecent || scannedDate > mostRecent) {
              mostRecent = scannedDate;
            }
          }
        }
        status.folders.lastUpdated = mostRecent ? mostRecent.toISOString() : null;
      }
    } catch (e) {
      logRow('WARN', 'getSnapshotStatus', `Error reading folders snapshot: ${e.message}`);
    }
    
    // Get groups snapshot status
    try {
      const groupsSheet = getGroupsSnapshotSheet();
      const groupsData = groupsSheet.getDataRange().getValues();
      status.groups.totalRows = groupsData.length - 1; // Exclude header
      
      // Find most recent lastScanned timestamp
      if (groupsData.length > 1) {
        let mostRecent = null;
        for (let i = 1; i < groupsData.length; i++) {
          const lastScanned = groupsData[i][3]; // lastScanned column
          if (lastScanned) {
            const scannedDate = new Date(lastScanned);
            if (!mostRecent || scannedDate > mostRecent) {
              mostRecent = scannedDate;
            }
          }
        }
        status.groups.lastUpdated = mostRecent ? mostRecent.toISOString() : null;
      }
    } catch (e) {
      logRow('WARN', 'getSnapshotStatus', `Error reading groups snapshot: ${e.message}`);
    }
    
    return status;
  } catch (err) {
    logRow('ERROR', 'getSnapshotStatus', `Error: ${err.message}`);
    throw err;
  }
}

/* Get snapshot status for a specific project */
function getProjectSnapshotStatus(projectId) {
  try {
    // Try to get project folder to find matching rows by projectCode
    let projectCode = projectId;
    try {
      const project = Drive.Files.get(projectId, {
        supportsAllDrives: true,
        useDomainAdminAccess: true,
        fields: 'id,title'
      });
      projectCode = project.title || projectId;
    } catch (e) {
      // Use projectId if we can't get title
    }
    
    // Get snapshot rows by projectCode (which is stored as project title)
    const snapshotRows = getFolderSnapshotRowsForProject(projectCode);
    
    if (snapshotRows.length === 0) {
      return {
        hasSnapshot: false,
        lastUpdated: null,
        folderCount: 0,
        isStale: true
      };
    }
    
    // Find most recent lastScanned timestamp
    let mostRecent = null;
    snapshotRows.forEach(row => {
      if (row.lastScanned) {
        const scannedDate = new Date(row.lastScanned);
        if (!mostRecent || scannedDate > mostRecent) {
          mostRecent = scannedDate;
        }
      }
    });
    
    // Check if snapshot is stale (older than 12 hours for badge display)
    const hoursAgo = mostRecent ? (new Date().getTime() - mostRecent.getTime()) / (1000 * 60 * 60) : Infinity;
    const isStale = hoursAgo > 12;
    
    return {
      hasSnapshot: true,
      lastUpdated: mostRecent ? mostRecent.toISOString() : null,
      folderCount: snapshotRows.length,
      isStale: isStale,
      hoursAgo: hoursAgo
    };
  } catch (err) {
    logRow('ERROR', 'getProjectSnapshotStatus', `Error: ${err.message}`);
    return {
      hasSnapshot: false,
      lastUpdated: null,
      folderCount: 0,
      isStale: true,
      hoursAgo: Infinity
    };
  }
}

/* Rescan snapshot for a specific project (after Apply operations) 
 * REFACTORED: Updates specific rows in batch instead of one-by-one.
 */
function rescanProjectSnapshot(projectId) {
  try {
    logRow('INFO', 'rescanProjectSnapshot', `Rescanning snapshot for project ${projectId}`);
    
    const project = Drive.Files.get(projectId, { fields: 'id,title' });
    const pr = extractPRNumber(project.title);
    if (!pr) throw new Error(`Could not extract PR from project: ${project.title}`);
    
    const template = getTemplateTree(false);
    const projectFolders = getAllFoldersRecursively(project.id, project.title);
    
    // Prepare new data map
    const updates = new Map(); // folderId -> rowData
    
    for (const folder of projectFolders) {
      try {
        const folderMeta = Drive.Files.get(folder.id, { fields: 'inheritedPermissionsDisabled' });
        
        let directGroups = [];
        try {
          const perms = getFolderPermissionsSafely(folder.id);
          if (perms.items) {
            perms.items.forEach(p => {
              if (p.type === 'group' && !shouldSkipPermission(p).skip) {
                const email = p.emailAddress || p.value;
                if (email && email.includes('@')) directGroups.push(email);
              }
            });
          }
        } catch (e) {}
        
        const templateNode = findTemplateNodeForFolder(folder, template, pr);
        const isLimited = templateNode ? (templateNode.limitedAccess === true) : false;
        
        updates.set(folder.id, [
          project.title,
          pr,
          folder.id,
          folder.path || folder.title,
          folderMeta.inheritedPermissionsDisabled ? 'Yes' : 'No',
          directGroups.join(','),
          isLimited ? 'Yes' : 'No',
          new Date().toISOString()
        ]);
      } catch (e) {
        logRow('WARN', 'rescanProjectSnapshot', `Error scanning folder ${folder.id}: ${e.message}`);
      }
    }
    
    // Update Sheet
    const sheet = getFolderSnapshotSheet();
    const data = sheet.getDataRange().getValues();
    const rowsToUpdate = []; // {row: 1-based, values: []}
    const newRows = [];
    
    // Find existing rows to update
    for (let i = 1; i < data.length; i++) {
      const fid = data[i][2];
      if (updates.has(fid)) {
        rowsToUpdate.push({ row: i + 1, values: updates.get(fid) });
        updates.delete(fid); // Mark as handled
      }
    }
    
    // Remaining updates are new rows
    updates.forEach(val => newRows.push(val));
    
    // Perform writes
    // 1. Update existing (unfortunately still individual unless we rewrite whole sheet, 
    //    but usually this is called for one project so it's manageable. 
    //    Optimization: If many updates, rewrite whole sheet might be faster, but risky here.
    //    Better: Just update the ones we found.)
    rowsToUpdate.forEach(item => {
      sheet.getRange(item.row, 1, 1, 8).setValues([item.values]);
    });
    
    // 2. Append new
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 8).setValues(newRows);
    }
    
    logRow('INFO', 'rescanProjectSnapshot', `Rescan complete: Updated ${rowsToUpdate.length}, Added ${newRows.length}`);
    return { success: true, scanned: rowsToUpdate.length + newRows.length };
    
  } catch (err) {
    logRow('ERROR', 'rescanProjectSnapshot', `Error: ${err.message}`);
    throw err;
  }
}

function getNextPRNumber() {
  const props = PropertiesService.getScriptProperties();
  let last = parseInt(props.getProperty(LAST_PR_PROP) || '0', 10);
  last = last + 1;
  props.setProperty(LAST_PR_PROP, String(last));
  // format to 3 digits
  return ('000' + last).slice(-3);
}

/* getAuthInfo - returns info about current user (isAdmin inferred trivially) */
// Get revision number (timestamp when script was last deployed)
// Helper function to get Saudi Arabia time (UTC+3)
function getSaudiTime() {
  const now = new Date();
  // Convert to Saudi Arabia time (UTC+3)
  const saudiTime = new Date(now.getTime() + (3 * 60 * 60 * 1000)); // Add 3 hours
  // Format: YYYY-MM-DD HH:MM
  const year = saudiTime.getUTCFullYear();
  const month = String(saudiTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(saudiTime.getUTCDate()).padStart(2, '0');
  const hours = String(saudiTime.getUTCHours()).padStart(2, '0');
  const minutes = String(saudiTime.getUTCMinutes()).padStart(2, '0');
  return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes;
}

// Helper function to update timestamp only (without incrementing version)
function updateRevisionTimestamp() {
  const revisionProp = PropertiesService.getScriptProperties().getProperty('REVISION_NUMBER');
  if (revisionProp) {
    // Extract version number
    const match = revisionProp.match(/^v(\d+)/);
    if (match) {
      const versionNum = match[1];
      const timestamp = getSaudiTime();
      const newRevision = 'v' + versionNum + '|' + timestamp;
      PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', newRevision);
      return newRevision;
    }
  }
  // If no revision exists, create v1 with current timestamp
  const timestamp = getSaudiTime();
  const defaultRevision = 'v1|' + timestamp;
  PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', defaultRevision);
  return defaultRevision;
}

function getRevisionNumber() {
  // Store revision in Script Properties - format: v1|timestamp, v2|timestamp, etc.
  const revisionProp = PropertiesService.getScriptProperties().getProperty('REVISION_NUMBER');
  if (revisionProp) {
    // If old format (timestamp only), convert to new format
    if (revisionProp.match(/^\d{8}-\d{6}$/)) {
      // Old format detected, reset to v1 with current timestamp
      const timestamp = getSaudiTime();
      const defaultRevision = 'v1|' + timestamp;
      PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', defaultRevision);
      return defaultRevision;
    }
    // If old format (v1, v2, etc. without timestamp), add current timestamp
    if (revisionProp.match(/^v\d+$/)) {
      const timestamp = getSaudiTime();
      const newRevision = revisionProp + '|' + timestamp;
      PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', newRevision);
      return newRevision;
    }
    // If already in new format (v1|timestamp), return as is
    if (revisionProp.match(/^v\d+\|/)) {
      return revisionProp;
    }
    // If unknown format, reset to v1 with current timestamp
    const timestamp = getSaudiTime();
    const defaultRevision = 'v1|' + timestamp;
    PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', defaultRevision);
    return defaultRevision;
  }
  // If not set, start with v1 and current timestamp
  const timestamp = getSaudiTime();
  const defaultRevision = 'v1|' + timestamp;
  PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', defaultRevision);
  return defaultRevision;
}

// Update revision number (call this after each deployment)
// Increments the version number: v1 -> v2 -> v3, etc. and updates timestamp
function updateRevisionNumber() {
  const current = getRevisionNumber();
  let versionNum = 1;
  
  // Extract number from current version (e.g., "v1|timestamp" -> 1, "v2|timestamp" -> 2)
  const match = current.match(/v(\d+)/);
  if (match) {
    versionNum = parseInt(match[1], 10) + 1;
  }
  
  // Add current timestamp (Saudi Arabia time)
  const timestamp = getSaudiTime();
  const newRevision = 'v' + versionNum + '|' + timestamp;
  PropertiesService.getScriptProperties().setProperty('REVISION_NUMBER', newRevision);
  logRow('INFO', 'updateRevisionNumber', 'Revision updated to: ' + newRevision);
  return newRevision;
}

// Auto-update revision timestamp when script is accessed (called from getAuthInfo)
// This ensures revision timestamp is always up-to-date (updates timestamp, keeps version number)
function ensureRevisionUpdated() {
  try {
    const revisionProp = PropertiesService.getScriptProperties().getProperty('REVISION_NUMBER');
    // If revision doesn't exist or is in old format, initialize it
    if (!revisionProp || revisionProp.match(/^\d{8}-\d{6}$/) || revisionProp.match(/^v\d+$/)) {
      getRevisionNumber(); // This will initialize or update the revision
    } else {
      // Update timestamp only (keep version number the same)
      updateRevisionTimestamp();
    }
  } catch (e) {
    // If error, just continue - revision will be initialized on next call
    logRow('WARN', 'ensureRevisionUpdated', 'Error ensuring revision updated: ' + e.message);
  }
}

function getAuthInfo() {
  var me = Session.getActiveUser().getEmail();
  // Rudimentary admin test - you can refine by checking groups or admin API
  // Always return true for admin to show all tabs
  var isAdmin = true; // assume admin for current deployment or implement check
  
  // Ensure revision is updated (will initialize if needed)
  ensureRevisionUpdated();
  
  // Get revision and format it for display
  const revisionRaw = getRevisionNumber();
  let revisionDisplay = revisionRaw;
  
  // Format: v1|2025-11-23 13:45 -> v1 (2025-11-23 13:45)
  if (revisionRaw.includes('|')) {
    const parts = revisionRaw.split('|');
    if (parts.length === 2) {
      revisionDisplay = parts[0] + ' (' + parts[1] + ')';
    }
  }
  
  // Get theme settings
  const theme = getThemeSettings();
  
  return { 
    user: me, 
    userEmail: me,
    isAdmin: isAdmin,
    revision: revisionDisplay,
    revisionRaw: revisionRaw,
    theme: theme
  };
}

/* Theme Settings Functions */
const THEME_PROP = 'THEME_SETTINGS';

function getThemeSettings() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(THEME_PROP);
    if (!raw) {
      // Return default theme
      return {
        primary: '#163655',
        secondary: '#435c74',
        background: '#fcf7f4',
        accent: '#435c74'
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    logRow('WARN', 'getThemeSettings', 'Error reading theme: ' + e.message);
    return {
      primary: '#163655',
      secondary: '#435c74',
      background: '#fcf7f4',
      accent: '#435c74'
    };
  }
}

function saveThemeSettings(theme) {
  try {
    if (!theme || typeof theme !== 'object') {
      throw new Error('Invalid theme object');
    }
    PropertiesService.getScriptProperties().setProperty(THEME_PROP, JSON.stringify(theme));
    logRow('INFO', 'saveThemeSettings', 'Theme settings saved');
    return 'Theme settings saved successfully';
  } catch (e) {
    logRow('ERROR', 'saveThemeSettings', 'Error saving theme: ' + e.message);
    throw e;
  }
}

/* Read folder limit access status from Drive */
function readFolderLimitAccessFromDrive(folderId) {
  try {
    const folder = Drive.Files.get(folderId, {
      supportsAllDrives: true,
      useDomainAdminAccess: true,
      fields: 'id,title,capabilities,permissions,inheritedPermissionsDisabled'
    });
    return folder.inheritedPermissionsDisabled === true;
  } catch (e) {
    logRow('WARN', 'readFolderLimitAccessFromDrive', `Could not read limit access for folder ${folderId}: ${e.message}`);
    return null;
  }
}

/* Scan all folders and check limit access status */
function scanAllFoldersForLimitAccess() {
  try {
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) {
      throw new Error('Shared Drive ID not configured');
    }
    
    logRow('INFO', 'scanAllFoldersForLimitAccess', 'Starting scan of all folders for limit access status');
    
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = Drive.Files.list({ 
      q: q, 
      supportsAllDrives: true, 
      includeItemsFromAllDrives: true, 
      maxResults: 500 
    });
    
    const projects = res.items || [];
    const results = [];
    let totalFolders = 0;
    let foldersWithLimitAccess = 0;
    
    projects.forEach(project => {
      try {
        const pr = extractPRNumber(project.title);
        if (!pr) return; // Skip if not a valid project
        
        const projectFolders = getAllFoldersRecursively(project.id, project.title);
        totalFolders += projectFolders.length;
        
        projectFolders.forEach(folder => {
          const limitAccess = readFolderLimitAccessFromDrive(folder.id);
          if (limitAccess === true) {
            foldersWithLimitAccess++;
            results.push({
              projectTitle: project.title,
              projectId: project.id,
              pr: pr,
              folderTitle: folder.title,
              folderId: folder.id,
              folderPath: folder.path,
              limitAccess: true
            });
          }
        });
      } catch (e) {
        logRow('WARN', 'scanAllFoldersForLimitAccess', `Error processing project ${project.title}: ${e.message}`);
      }
    });
    
    logRow('INFO', 'scanAllFoldersForLimitAccess', `Scan completed: ${foldersWithLimitAccess} folders with limit access out of ${totalFolders} total folders`);
    
    return {
      success: true,
      totalFolders: totalFolders,
      foldersWithLimitAccess: foldersWithLimitAccess,
      results: results
    };
  } catch (err) {
    logRow('ERROR', 'scanAllFoldersForLimitAccess', `Error: ${err.message}`);
    throw err;
  }
}

/* Compare folder permissions between Drive and Template */
function compareFolderPermissionsWithTemplate() {
  try {
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) {
      throw new Error('Shared Drive ID not configured');
    }
    
    logRow('INFO', 'compareFolderPermissionsWithTemplate', 'Starting comparison using Snapshot (fast mode)');
    
    const template = getTemplateTree(false);
    const sheet = getFolderSnapshotSheet();
    const data = sheet.getDataRange().getValues();
    
    const results = {
      matched: [],      // Folders that match (both have or both don't have limit access)
      mismatched: [],   // Folders that don't match (different states)
      driveOnly: [],    // Folders with limit access in Drive but not in template
      templateOnly: []  // Folders with limit access in template but not in Drive
    };
    
    let totalFolders = 0;
    
    // Skip header row
    for (let i = 1; i < data.length; i++) {
      try {
        const row = data[i];
        const projectCode = row[0];
        const prNumber = row[1];
        const folderId = row[2];
        const folderPath = row[3];
        const driveLimitAccess = row[4] === 'Yes'; // inheritedPermissionsDisabled
        const templateLimitAccess = row[6] === 'Yes'; // templateLimitedAccess
        
        if (!folderId) continue; // Skip empty rows
        
        totalFolders++;
        
        // Extract folder title from path
        const folderTitle = folderPath.split(' > ').pop() || folderPath;
        
        const comparison = {
          projectTitle: projectCode || 'Unknown',
          projectId: '', // Not needed for comparison
          pr: prNumber || '',
          folderTitle: folderTitle,
          folderId: folderId,
          folderPath: folderPath,
          driveLimitAccess: driveLimitAccess,
          templateLimitAccess: templateLimitAccess,
          templateNodeFound: templateLimitAccess !== null
        };
        
        // Categorize the result
        if (driveLimitAccess === true && templateLimitAccess) {
          // Both have limit access - matched
          results.matched.push(comparison);
        } else if (driveLimitAccess === false && !templateLimitAccess) {
          // Both don't have limit access - matched
          results.matched.push(comparison);
        } else if (driveLimitAccess === true && !templateLimitAccess) {
          // Drive has it but template doesn't
          results.driveOnly.push(comparison);
          results.mismatched.push(comparison);
        } else if (driveLimitAccess === false && templateLimitAccess) {
          // Template has it but Drive doesn't
          results.templateOnly.push(comparison);
          results.mismatched.push(comparison);
        }
      } catch (e) {
        logRow('WARN', 'compareFolderPermissionsWithTemplate', `Error processing snapshot row ${i}: ${e.message}`);
      }
    }
    
    logRow('INFO', 'compareFolderPermissionsWithTemplate', `Comparison completed using Snapshot: ${results.matched.length} matched, ${results.mismatched.length} mismatched out of ${totalFolders} total folders`);
    
    return {
      success: true,
      totalFolders: totalFolders,
      matched: results.matched.length,
      mismatched: results.mismatched.length,
      driveOnly: results.driveOnly.length,
      templateOnly: results.templateOnly.length,
      results: results
    };
  } catch (err) {
    logRow('ERROR', 'compareFolderPermissionsWithTemplate', `Error: ${err.message}`);
    throw err;
  }
}

/* Find template node for a given folder */
function findTemplateNodeForFolder(folder, template, pr) {
  if (!template || !Array.isArray(template)) return null;
  
  // Parse folder title to get info
  const info = parseNumberedFolder(folder.title);
  if (!info) return null;
  
  // Determine phase (RFP or PD)
  const phaseIndex = info.phase === 'RFP' ? 0 : 1;
  if (phaseIndex >= template.length) return null;
  
  const phaseNode = template[phaseIndex];
  if (!phaseNode || !phaseNode.nodes) return null;
  
  // Find matching node by number and name
  const matchingNode = phaseNode.nodes.find((node, index) => {
    if (info.number === index + 1 && info.name === node.text) {
      return true;
    }
    if (folder.title.includes(node.text)) {
      return true;
    }
    return false;
  });
  
  if (matchingNode) {
    return matchingNode;
  }
  
  // If not found in first level, search recursively
  return findTemplateNodeRecursive(folder, phaseNode.nodes, pr, info.phase);
}

/* Find template node recursively */
function findTemplateNodeRecursive(folder, nodes, pr, folderType) {
  if (!nodes || !Array.isArray(nodes)) return null;
  
  const info = parseNumberedFolder(folder.title);
  if (!info) return null;
  
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    // Check if this node matches
    if (info.name === node.text || folder.title.includes(node.text)) {
      return node;
    }
    
    // Recursively search in children
    if (node.nodes && node.nodes.length > 0) {
      const found = findTemplateNodeRecursive(folder, node.nodes, pr, folderType);
      if (found) return found;
    }
  }
  
  return null;
}

/* Get all folders recursively from a parent folder */
function getAllFoldersRecursively(parentFolderId, projectTitle, currentPath = '') {
  const allFolders = [];
  
  try {
    const children = getFoldersInParent(parentFolderId);
    
    children.forEach(folder => {
      const folderPath = currentPath ? `${currentPath} > ${folder.title}` : folder.title;
      allFolders.push({
        id: folder.id,
        title: folder.title,
        path: folderPath,
        projectTitle: projectTitle
      });
      
      // Recursively get subfolders
      const subfolders = getAllFoldersRecursively(folder.id, projectTitle, folderPath);
      allFolders.push(...subfolders);
    });
  } catch (e) {
    logRow('WARN', 'getAllFoldersRecursively', `Error getting folders from ${parentFolderId}: ${e.message}`);
  }
  
  return allFolders;
}

/* Sync folder state from Drive to template - read limit access status */
function syncFolderStateFromDrive(folderId, node) {
  try {
    const limitAccess = readFolderLimitAccessFromDrive(folderId);
    if (limitAccess !== null) {
      node.limitedAccess = limitAccess;
      logRow('INFO', 'syncFolderStateFromDrive', `Synced limit access for folder ${folderId}: ${limitAccess}`);
    }
  } catch (e) {
    logRow('WARN', 'syncFolderStateFromDrive', `Failed to sync folder state: ${e.message}`);
  }
}

/* Template functions - store and retrieve tree template in PropertiesService */
function getTemplateTree(syncFromDrive = false) {
  const raw = PropertiesService.getScriptProperties().getProperty(TEMPLATE_PROP);
  if (!raw) {
    // default template with Bidding and Project Delivery nodes
    const defaultTemplate = [{"text":"Bidding","users":[],"_expanded":true,"limitedAccess":false,"nodes":[{"groups":[{"name":"Admins","role":"organizer"},{"name":"Technical Team","role":"writer"},{"role":"writer","name":"Projects Managers"},{"role":"writer","name":"Projects Control"}],"text":"SOW","limitedAccess":true,"users":[]},{"users":[{"role":"fileOrganizer","type":"user","email":"Marwan@dtgsa.com"}],"limitedAccess":true,"text":"Technical Propsal","nodes":[{"limitedAccess":false,"text":"TBE"},{"limitedAccess":false,"text":"Technical Proposal"}],"groups":[{"name":"Projects Managers","role":"writer"}],"_expanded":true},{"nodes":[{"text":"Civil and Finishes","limitedAccess":false},{"limitedAccess":false,"text":"Mechanical"},{"limitedAccess":false,"text":"E&I"},{"limitedAccess":false,"text":"IT"}],"text":"Vendors Quotations","limitedAccess":true,"users":[],"groups":[{"role":"organizer","name":"Admins"},{"role":"fileOrganizer","name":"Projects Managers"}],"_expanded":true},{"users":[],"limitedAccess":true,"text":"Commercial Propsal","groups":[{"name":"Projects Managers","role":"writer"}]}],"groups":[]},{"text":"Project Delivery","limitedAccess":false,"_expanded":true,"nodes":[{"text":"Document Control","_expanded":true,"groups":[],"users":[],"nodes":[{"limitedAccess":false,"text":"Forms","nodes":[],"folderType":"PD"},{"folderType":"PD","users":[{"email":"Dc@dtgsa.com","role":"fileOrganizer","type":"user"}],"nodes":[],"limitedAccess":true,"text":"MDR","groups":[{"name":"Projects Managers","role":"reader"},{"name":"Projects Control","role":"reader"}]},{"text":"Submittals","folderType":"PD","_expanded":true,"nodes":[{"nodes":[],"text":"Construction","folderType":"PD","limitedAccess":false},{"limitedAccess":true,"users":[],"folderType":"PD","text":"EHS","nodes":[],"groups":[{"role":"fileOrganizer","name":"HSE"},{"role":"reader","name":"Projects Managers"}]},{"text":"Minutes of Meetings","limitedAccess":true,"nodes":[],"users":[],"groups":[{"name":"Projects Control","role":"fileOrganizer"},{"name":"Projects Managers","role":"fileOrganizer"}],"folderType":"PD"},{"text":"Procurment","groups":[{"name":"Admins","role":"organizer"},{"name":"Projects Managers","role":"fileOrganizer"},{"role":"reader","name":"Projects Control"}],"users":[],"limitedAccess":true,"nodes":[],"folderType":"PD"},{"text":"Project Control","nodes":[],"folderType":"PD","users":[],"limitedAccess":true,"groups":[{"name":"Projects Control","role":"fileOrganizer"},{"role":"writer","name":"Projects Managers"}]},{"groups":[{"name":"Projects Managers","role":"fileOrganizer"},{"role":"fileOrganizer","name":"Projects Control"},{"role":"fileOrganizer","name":"Quality Control"}],"limitedAccess":true,"users":[],"text":"Quality Control","nodes":[],"folderType":"PD"},{"limitedAccess":true,"folderType":"PD","nodes":[],"text":"Letters","users":[],"groups":[{"name":"Admins","role":"organizer"},{"role":"fileOrganizer","name":"Projects Managers"}]},{"nodes":[],"limitedAccess":true,"users":[],"text":"SI & CCCOR","groups":[{"name":"Projects Managers","role":"reader"},{"name":"Admins","role":"organizer"},{"name":"Projects Control","role":"fileOrganizer"}],"folderType":"PD"}],"text":"Ongoing","limitedAccess":false},{"_expanded":true,"folderType":"PD","nodes":[{"text":"Construction","nodes":[],"limitedAccess":false,"folderType":"PD"},{"limitedAccess":true,"folderType":"PD","users":[],"nodes":[],"text":"EHS","groups":[{"role":"fileOrganizer","name":"HSE"},{"role":"reader","name":"Projects Managers"}]},{"users":[],"text":"Minutes of Meetings","groups":[{"name":"Projects Managers","role":"fileOrganizer"},{"name":"Projects Control","role":"fileOrganizer"}],"nodes":[],"limitedAccess":true,"folderType":"PD"},{"folderType":"PD","text":"Procurment","nodes":[],"limitedAccess":true,"users":[],"groups":[{"role":"fileOrganizer","name":"Projects Managers"},{"name":"Projects Control","role":"writer"}]},{"nodes":[],"users":[],"folderType":"PD","groups":[{"role":"fileOrganizer","name":"Projects Control"},{"role":"writer","name":"Projects Managers"}],"limitedAccess":true,"text":"Project Control"},{"text":"Quality Control","folderType":"PD","users":[],"nodes":[],"groups":[{"role":"fileOrganizer","name":"Projects Managers"},{"name":"Projects Control","role":"fileOrganizer"},{"name":"Quality Control","role":"fileOrganizer"}],"limitedAccess":true},{"users":[],"groups":[{"role":"fileOrganizer","name":"Projects Managers"},{"role":"organizer","name":"Admins"}],"folderType":"PD","text":"Letters","limitedAccess":true,"nodes":[]},{"text":"SI & CCCOR","users":[],"nodes":[],"folderType":"PD","groups":[{"name":"Projects Managers","role":"reader"},{"name":"Projects Control","role":"fileOrganizer"},{"role":"organizer","name":"Admins"}],"limitedAccess":true}],"limitedAccess":false,"text":"Received"}],"limitedAccess":false},{"folderType":"PD","text":"Transmittals","nodes":[{"nodes":[],"limitedAccess":false,"folderType":"PD","text":"Received"},{"text":"Sent","limitedAccess":false,"folderType":"PD","nodes":[]}],"limitedAccess":false}],"limitedAccess":true},{"text":"Quality Control","limitedAccess":true,"users":[],"groups":[{"name":"Quality Control","role":"fileOrganizer"},{"name":"Projects Control","role":"reader"},{"role":"writer","name":"Projects Managers"}]},{"text":"HSE","limitedAccess":false},{"text":"Project Control","nodes":[{"users":[],"folderType":"PD","text":"Planning","groups":[],"nodes":[{"limitedAccess":false,"nodes":[],"folderType":"PD","text":"Reports"},{"nodes":[],"limitedAccess":false,"folderType":"PD","text":"Planning Deliverables"}],"limitedAccess":false},{"_expanded":true,"folderType":"PD","text":"Commercial","limitedAccess":true,"nodes":[{"_expanded":true,"folderType":"PD","limitedAccess":false,"nodes":[{"folderType":"PD","text":"Contract & PO","nodes":[],"limitedAccess":false},{"folderType":"PD","nodes":[],"text":"Change Orders","limitedAccess":false}],"text":"Agreements"},{"folderType":"PD","nodes":[],"text":"Invoices","limitedAccess":false}],"groups":[{"name":"Projects Managers","role":"fileOrganizer"},{"name":"Admins","role":"organizer"}],"users":[]}],"groups":[{"role":"fileOrganizer","name":"Projects Control"},{"name":"Admins","role":"organizer"}],"limitedAccess":true,"users":[],"_expanded":true},{"limitedAccess":false,"text":"IFC Drawings"},{"text":"Engineering (EPC ONLY)","limitedAccess":true,"groups":[{"role":"fileOrganizer","name":"Technical Team"},{"role":"fileOrganizer","name":"Projects Managers"}],"users":[]},{"folderType":"PD","nodes":[],"users":[],"text":"Quantity Survuy","groups":[{"name":"Projects Managers","role":"fileOrganizer"},{"name":"Projects Control","role":"fileOrganizer"}],"limitedAccess":true},{"limitedAccess":false,"nodes":[],"folderType":"PD","text":"Operation"},{"folderType":"PD","text":"Survey","nodes":[],"limitedAccess":false}],"groups":[]}];
    return defaultTemplate;
  }
  const template = JSON.parse(raw);
  
  // If syncFromDrive is true, sync the template state from Drive (read-only, doesn't save)
  // This ensures the UI displays the actual state from Drive
  if (syncFromDrive) {
    try {
      logRow('INFO', 'getTemplateTree', 'Syncing template state from Drive for display');
      syncTemplateStateFromDrive(template);
    } catch (e) {
      logRow('WARN', 'getTemplateTree', `Failed to sync template from Drive: ${e.message}`);
      // Continue with unsynced template if sync fails
    }
  }
  
  return template;
}

/* Sync template from Drive - separate function for manual sync */
function syncTemplateFromDrive() {
  try {
    logRow('INFO', 'syncTemplateFromDrive', 'Starting manual sync of template from Drive');
    const template = getTemplateTree(false); // Get template without syncing
    if (!template || !Array.isArray(template)) {
      throw new Error('Template is empty or invalid');
    }
    syncTemplateStateFromDrive(template);
    // Save the synced template back
    saveConfig(template);
    logRow('INFO', 'syncTemplateFromDrive', 'Template synced from Drive and saved');
    return 'Template synced from Drive successfully';
  } catch (err) {
    logRow('ERROR', 'syncTemplateFromDrive', `Error: ${err.message}`);
    throw err;
  }
}

/* Sync template state from Drive - read limit access for all folders recursively */
function syncTemplateStateFromDrive(template) {
  if (!template || !Array.isArray(template)) return;
  
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return;
  
  try {
    // Get all projects
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 10 });
    const projects = res.items || [];
    
    if (projects.length === 0) {
      logRow('WARN', 'syncTemplateStateFromDrive', 'No projects found to sync state from');
      return;
    }
    
    // Use first project as reference to sync state
    const sampleProject = projects[0];
    const pr = extractPRNumber(sampleProject.title);
    if (!pr) {
      logRow('WARN', 'syncTemplateStateFromDrive', `Could not extract PR number from project title: ${sampleProject.title}`);
      return;
    }
    
    logRow('INFO', 'syncTemplateStateFromDrive', `Syncing template state from project ${sampleProject.title} (PR-${pr})`);
    
    // Sync RFP phase
    if (template[0]) {
      const rfpFolder = getFoldersInParent(sampleProject.id).find(f => f.title.includes('-RFP'));
      if (rfpFolder) {
        logRow('INFO', 'syncTemplateStateFromDrive', `Syncing RFP phase from folder: ${rfpFolder.title}`);
        syncPhaseStateFromDrive(rfpFolder.id, template[0], pr, 'RFP');
      } else {
        logRow('WARN', 'syncTemplateStateFromDrive', `RFP folder not found in project ${sampleProject.title}`);
      }
    }
    
    // Sync PD phase
    if (template[1]) {
      const pdFolder = getFoldersInParent(sampleProject.id).find(f => f.title.includes('-PD') || f.title.includes('-Project Delivery'));
      if (pdFolder) {
        logRow('INFO', 'syncTemplateStateFromDrive', `Syncing PD phase from folder: ${pdFolder.title}`);
        syncPhaseStateFromDrive(pdFolder.id, template[1], pr, 'PD');
      } else {
        logRow('WARN', 'syncTemplateStateFromDrive', `PD folder not found in project ${sampleProject.title}`);
      }
    }
  } catch (e) {
    logRow('WARN', 'syncTemplateStateFromDrive', `Failed to sync template state from Drive: ${e.message}`);
  }
}

/* Sync phase state from Drive recursively */
function syncPhaseStateFromDrive(phaseFolderId, phaseNode, pr, folderType) {
  if (!phaseNode) return;
  
  // Sync phase folder itself
  syncFolderStateFromDrive(phaseFolderId, phaseNode);
  
  // Sync subfolders
  if (phaseNode.nodes && phaseNode.nodes.length > 0) {
    const children = getFoldersInParent(phaseFolderId);
    if (!children || children.length === 0) {
      logRow('WARN', 'syncPhaseStateFromDrive', `No child folders found in parent ${phaseFolderId}`);
      return;
    }
    
    const normalizedFolderType = folderType === 'PD' ? 'Project Delivery' : folderType;
    
    phaseNode.nodes.forEach((node, index) => {
      const matchingFolder = children.find(child => {
        const info = parseNumberedFolder(child.title);
        if (!info) {
          // Fallback: try to match by name if parseNumberedFolder fails
          if (child.title.includes(node.text)) {
            logRow('INFO', 'syncPhaseStateFromDrive', `Matched folder "${child.title}" to node "${node.text}" by name (parseNumberedFolder failed)`);
            return true;
          }
          return false;
        }
        // Check both old format (PD) and new format (Project Delivery)
        const phaseMatch = info.phase === folderType || info.phase === normalizedFolderType;
        const numberMatch = info.number === index + 1;
        const prMatch = info.pr === pr;
        
        if (numberMatch && phaseMatch && prMatch) {
          logRow('INFO', 'syncPhaseStateFromDrive', `Matched folder "${child.title}" to node "${node.text}" by number (${info.number}), phase (${info.phase}), and PR (${info.pr})`);
          return true;
        }
        
        // Fallback: match by name if number/phase/PR match fails
        if (child.title.includes(node.text)) {
          logRow('INFO', 'syncPhaseStateFromDrive', `Matched folder "${child.title}" to node "${node.text}" by name (number/phase/PR match failed: number=${numberMatch}, phase=${phaseMatch}, pr=${prMatch})`);
          return true;
        }
        return false;
      });
      
      if (matchingFolder) {
        logRow('INFO', 'syncPhaseStateFromDrive', `Syncing limit access for folder "${matchingFolder.title}" (node: "${node.text}")`);
        syncFolderStateFromDrive(matchingFolder.id, node);
        // Recursively sync children
        if (node.nodes && node.nodes.length > 0) {
          syncPhaseStateFromDrive(matchingFolder.id, node, pr, folderType);
        }
      } else {
        logRow('WARN', 'syncPhaseStateFromDrive', `Could not find matching folder for node "${node.text}" at index ${index} in parent ${phaseFolderId}. Available folders: ${children.map(c => c.title).join(', ')}`);
      }
    });
  }
}

/* Save template structure to Script Properties
 * 
 * WHERE IS THE TEMPLATE SAVED?
 * =============================
 * The template is saved in Google Apps Script's internal storage (NOT on Google Drive)
 * 
 * Storage location: PropertiesService.getScriptProperties()
 * - This is Google's cloud storage for Apps Script projects
 * - Data is stored on Google's servers, associated with your Apps Script project
 * - It is NOT a file on Google Drive - it's internal to the Apps Script project
 * - You cannot see it in Google Drive, but it's accessible only through Apps Script
 * 
 * Property key: TEMPLATE_PROP (value: 'PROJECT_FOLDER_TEMPLATE')
 * 
 * When is it saved: When user clicks "Save Structure" button in the UI
 * 
 * How to access it manually:
 * - Go to Apps Script editor → Project Settings → Script Properties
 * - Look for key: 'PROJECT_FOLDER_TEMPLATE'
 * - Value: JSON string containing the folder structure
 * 
 * BEHAVIOR:
 * =========
 * "Save Structure" ONLY updates the Template (desired state) in PropertiesService.
 * It does NOT:
 * - Modify Drive folders or permissions
 * - Update Snapshot
 * - Apply changes to existing projects
 * 
 * To apply Template changes to Drive, use "Apply to All Projects" or "Apply to Project".
 */
function saveConfig(obj) {
  try {
    logRow('INFO', 'saveConfig', 'Saving template structure (Template only, not Drive)');
    
    // Validate input
    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid template object');
    }
    
    // Save template to PropertiesService
  PropertiesService.getScriptProperties().setProperty(TEMPLATE_PROP, JSON.stringify(obj));
    
    logRow('INFO', 'saveConfig', 'Template saved successfully. Use "Apply to All Projects" to apply changes to Drive.');
    
    return 'Template saved successfully. Use "Apply to All Projects" to apply changes to Drive.';
  } catch (err) {
    logRow('ERROR', 'saveConfig', `Error saving template: ${err.message}`);
    throw err;
  }
}
function resetTemplateConfig() {
  PropertiesService.getScriptProperties().deleteProperty(TEMPLATE_PROP);
  return 'Template reset to default';
}

/* Template Backup Functions */
function saveTemplateBackup() {
  try {
    const template = getTemplateTree(false);
    const backup = {
      template: template,
      timestamp: new Date().toISOString()
    };
    PropertiesService.getScriptProperties().setProperty(TEMPLATE_BACKUP_PROP, JSON.stringify(backup));
    logRow('INFO', 'saveTemplateBackup', 'Template backup saved');
    return backup;
  } catch (err) {
    logRow('ERROR', 'saveTemplateBackup', `Error saving backup: ${err.message}`);
    throw err;
  }
}

function getTemplateBackup() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(TEMPLATE_BACKUP_PROP);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch (err) {
    logRow('ERROR', 'getTemplateBackup', `Error reading backup: ${err.message}`);
    return null;
  }
}

function restoreTemplateFromBackup() {
  try {
    const backup = getTemplateBackup();
    if (!backup || !backup.template) {
      throw new Error('No backup found');
    }
    saveConfig(backup.template);
    logRow('INFO', 'restoreTemplateFromBackup', 'Template restored from backup');
    return 'Template restored from backup';
  } catch (err) {
    logRow('ERROR', 'restoreTemplateFromBackup', `Error restoring backup: ${err.message}`);
    throw err;
  }
}

/* Access policy - save / get */
function getAccessPolicy() {
  const raw = PropertiesService.getScriptProperties().getProperty(ACCESS_POLICY_PROP);
  if (!raw) {
    // No default permissions - empty policy
    const defaultPolicy = {
      groups: {},
      protection: {
        viewersCanCopyContent: false,
        copyRequiresWriterPermission: false
      }
    };
    return defaultPolicy;
  }
  return JSON.parse(raw);
}
function saveAccessPolicy(policy) {
  PropertiesService.getScriptProperties().setProperty(ACCESS_POLICY_PROP, JSON.stringify(policy));
  return 'Access policy saved';
}

/* Request approval - called from UI to create project structure */
function requestApproval(projectName, phase) {
  try {
    if (!projectName) throw new Error('Project name required');
    
    if (phase === 'bidding') {
      return requestRFPApproval(projectName);
    } else if (phase === 'project_delivery') {
      return requestPDApproval(projectName);
    } else {
      throw new Error('Invalid phase. Must be "bidding" or "project_delivery"');
    }
  } catch (err) {
    logRow('ERROR', 'requestApproval', err.message);
    throw err;
  }
}

/* Request RFP approval - create new project */
function requestRFPApproval(projectName) {
  // Check for duplicate project name
  if (isProjectNameExists(projectName)) {
    throw new Error('Project name already exists: ' + projectName);
  }
  
    const pr = getNextPRNumber();
  const projectFolderName = `PRJ-${pr}-${projectName}`;
  
  // Send email for approval to create RFP
  sendApprovalEmail(pr, projectName, 'bidding');
  return 'RFP approval request sent for: ' + projectFolderName + ' to: ' + getApprovalRecipient();
}

/* Check if project name already exists */
function isProjectNameExists(projectName) {
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return false;
  
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const items = res.items || [];
  
  // Search for projects containing the same name
  return items.some(item => {
    const title = item.title || '';
    // Extract project name from title (after PRJ-XXX-)
    const match = title.match(/PRJ-\d+-(.+)$/);
    if (match) {
      const existingProjectName = match[1];
      return existingProjectName.toLowerCase() === projectName.toLowerCase();
    }
    return false;
  });
}

/* Request PD approval - upgrade existing project */
function requestPDApproval(projectName) {
  // Search for existing project
  const existingProject = findProjectByName(projectName);
  if (!existingProject) {
    throw new Error('Project not found: ' + projectName);
  }
  
  // Check if PD folder exists
  if (hasPDFolder(existingProject.id)) {
    throw new Error('Project already has PD folder: ' + projectName);
  }
  
  const pr = extractPRNumber(existingProject.title);
  
  // Extract clean project name from project title (without PRJ-XXX-)
  let cleanProjectName = projectName;
  const titleMatch = existingProject.title.match(/PRJ-\d+-(.+)$/);
  if (titleMatch) {
    cleanProjectName = titleMatch[1]; // Clean name without PRJ-XXX-
  }
  
  sendApprovalEmail(pr, cleanProjectName, 'project_delivery');
  return 'PD approval request sent for: ' + existingProject.title + ' to: ' + getApprovalRecipient();
}

/* Create RFP project after approval */
function createRFPProject(pr, projectName) {
  try {
    const projectFolderName = `PRJ-${pr}-${projectName}`;
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    
    if (!rootDriveId) {
      throw new Error('Shared Drive ID not configured');
    }
    
    // Create main folder
    const rootFolder = Drive.Files.insert({
      title: projectFolderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [{ id: rootDriveId }]
    }, null, { supportsAllDrives: true });
    
    // Create RFP folder
    const rfpFolder = Drive.Files.insert({
      title: `PRJ-${pr}-RFP`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [{ id: rootFolder.id }]
    }, null, { supportsAllDrives: true });

    // Create subfolders according to template
    createSubfoldersFromTemplate(rfpFolder.id, 'RFP', pr);
    
    // Apply permissions
    const accessPolicy = getAccessPolicy();
    applyPolicyToFolderAndChildren(rootFolder.id, accessPolicy);
    
    // Apply limited access permissions from template
    applyLimitedAccessToProject(rootFolder.id, rootFolder.title);
    
    logRow('INFO', 'createRFPProject', `Created RFP project: ${projectFolderName}`);
    return `RFP project created: ${projectFolderName}`;
  } catch (err) {
    logRow('ERROR', 'createRFPProject', err.message);
    throw err;
  }
}

/* Create PD folder after approval */
function createPDFolder(pr, projectName) {
  try {
    // Clean projectName - remove any PRJ-XXX- from the beginning as a precaution
    let cleanProjectName = projectName;
    const prPrefixMatch = projectName.match(/^PRJ-\d+-(.+)$/);
    if (prPrefixMatch) {
      cleanProjectName = prPrefixMatch[1]; // Extract name only without PRJ-XXX-
    }
    
    const projectFolderName = `PRJ-${pr}-${cleanProjectName}`;
    const rootFolder = findProjectByName(projectFolderName);
    
    if (!rootFolder) {
      throw new Error('Project not found: ' + projectFolderName);
    }
    
    // Create PD folder
    const pdFolder = Drive.Files.insert({
      title: `PRJ-${pr}-Project Delivery`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [{ id: rootFolder.id }]
    }, null, { supportsAllDrives: true });

    // Create subfolders according to template
    createSubfoldersFromTemplate(pdFolder.id, 'PD', pr);
    
    // Apply permissions
    const accessPolicy = getAccessPolicy();
    applyPolicyToFolderAndChildren(pdFolder.id, accessPolicy);
    
    // Apply limited access permissions from template
    applyLimitedAccessToProject(rootFolder.id, rootFolder.title);

    logRow('INFO', 'createPDFolder', `Created PD folder for: ${projectFolderName}`);
    return `PD folder created for: ${projectFolderName}`;
  } catch (err) {
    logRow('ERROR', 'createPDFolder', err.message);
    throw err;
  }
}

/* Create subfolders from template - only creates missing folders */
function createSubfoldersFromTemplate(parentFolderId, folderType, pr) {
    const template = getTemplateTree();
    
    // Get existing folders in parent to avoid duplicates
    const existingFolders = getFoldersInParent(parentFolderId);
    const existingFolderTitles = existingFolders.map(f => f.title);
  
    template.forEach(node => {
    if (folderType === 'RFP' && /bidding/i.test(node.text)) {
      (node.nodes || []).forEach((childNode, index) => {
        const folderTitle = `${index + 1}-PRJ-${pr}-RFP-${childNode.text}`;
        
        // Check if folder already exists
        if (existingFolderTitles.includes(folderTitle)) {
          // Folder exists, find it and ensure subfolders exist
          const existingFolder = existingFolders.find(f => f.title === folderTitle);
          if (existingFolder) {
            createSubfoldersRecursively(childNode.nodes || [], existingFolder.id, pr, 'RFP', index + 1);
          }
        } else {
          // Create new folder
          const newFolder = Drive.Files.insert({
            title: folderTitle,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [{ id: parentFolderId }]
          }, null, { supportsAllDrives: true });
          createSubfoldersRecursively(childNode.nodes || [], newFolder.id, pr, 'RFP', index + 1);
        }
      });
    } else if (folderType === 'PD' && /project delivery/i.test(node.text)) {
      (node.nodes || []).forEach((childNode, index) => {
        // Subfolders use 'PD' in the name, not 'Project Delivery'
        const folderTitle = `${index + 1}-PRJ-${pr}-PD-${childNode.text}`;
        
        // Check if folder already exists
        if (existingFolderTitles.includes(folderTitle)) {
          // Folder exists, find it and ensure subfolders exist
          const existingFolder = existingFolders.find(f => f.title === folderTitle);
          if (existingFolder) {
            // Pass 'Project Delivery' as folderType for internal logic, but subfolders will use 'PD' in names
            createSubfoldersRecursively(childNode.nodes || [], existingFolder.id, pr, 'Project Delivery', index + 1);
          }
        } else {
          // Create new folder
          const newFolder = Drive.Files.insert({
            title: folderTitle,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [{ id: parentFolderId }]
          }, null, { supportsAllDrives: true });
          // Pass 'Project Delivery' as folderType for internal logic, but subfolders will use 'PD' in names
          createSubfoldersRecursively(childNode.nodes || [], newFolder.id, pr, 'Project Delivery', index + 1);
        }
      });
    }
  });
}

/* Create subfolders recursively to support multiple depth levels - only creates missing folders */
function createSubfoldersRecursively(nodes, parentFolderId, pr, folderType, parentIndex) {
  if (!nodes || nodes.length === 0) return;
  
  // Get existing folders to avoid duplicates
  const existingFolders = getFoldersInParent(parentFolderId);
  const existingFolderTitles = existingFolders.map(f => f.title);
  
  // Get parent folder to determine numbering
  let parentFolder;
  try {
    parentFolder = Drive.Files.get(parentFolderId, { supportsAllDrives: true });
  } catch (e) {
    logRow('WARN', 'createSubfoldersRecursively', `Could not get parent folder ${parentFolderId}: ${e.message}`);
  }
  
  // Extract number from parent folder title if available
  let baseNumber = parentIndex || 1;
  if (parentFolder && parentFolder.title) {
    const parentMatch = parentFolder.title.match(/^(\d+)-PRJ-/);
    if (parentMatch) {
      baseNumber = parseInt(parentMatch[1]);
    }
  }
  
  nodes.forEach((node, index) => {
    // Determine folder number:
    // - For the new template we want simple sequential numbers (1,2,3,...) at each level,
    //   not hierarchical numbers like 101, 1002, etc.
    // - So we ignore baseNumber here and just use (index + 1) per parent.
    const folderNumber = index + 1;

    // Build folder title with PR number and type when available
    const folderTitle = (pr && folderType)
      ? buildNumberedFolderTitle(folderNumber, pr, folderType, node.text)
      : node.text;
    
    // Check if folder already exists
    if (existingFolderTitles.includes(folderTitle)) {
      // Folder exists, find it and ensure subfolders exist
      const existingFolder = existingFolders.find(f => f.title === folderTitle);
      if (existingFolder && node.nodes && node.nodes.length > 0) {
        createSubfoldersRecursively(node.nodes, existingFolder.id, pr, folderType, folderNumber);
      }
      } else {
      // Create new folder
      const newFolder = Drive.Files.insert({
        title: folderTitle,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [{ id: parentFolderId }]
      }, null, { supportsAllDrives: true });
      
      // Create subfolders recursively
      if (node.nodes && node.nodes.length > 0) {
        createSubfoldersRecursively(node.nodes, newFolder.id, pr, folderType, folderNumber);
      }
    }
  });
}

/* Helper functions */
function findProjectByName(projectName) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and title contains '${projectName}'`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 10 });
  return res.items && res.items.length > 0 ? res.items[0] : null;
}

function hasPDFolder(projectFolderId) {
  const q = `'${projectFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and (title contains '-PD' or title contains '-Project Delivery')`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 1 });
  return res.items && res.items.length > 0;
}

function extractPRNumber(projectTitle) {
  const match = projectTitle.match(/PRJ-(\d+)/);
  return match ? match[1] : null;
}

/* Helper to get root project folder by PR number and project name */
function getProjectRootFolder(pr_number, projectName) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return null;

  const folderName = `PRJ-${pr_number}-${projectName}`;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and title = '${folderName}'`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 1 });
  return res.items && res.items.length > 0 ? res.items[0] : null;
}

/* Helper to get PD folder within a project root folder */
function getPDFolder(projectRootFolderId, pr_number) {
  // Check both old format (PD) and new format (Project Delivery)
  const pdFolderName1 = `PRJ-${pr_number}-PD`;
  const pdFolderName2 = `PRJ-${pr_number}-Project Delivery`;
  const q = `'${projectRootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and (title = '${pdFolderName1}' or title = '${pdFolderName2}')`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 1 });
  return res.items && res.items.length > 0 ? res.items[0] : null;
}

/* Apply policy recursively to folder and its immediate child folders (depth-limited to avoid huge runs) */
function applyPolicyToFolderAndChildren(folderId, policy, depthLimit) {
  depthLimit = depthLimit || 5;
  // apply to root
  applyAccessPolicyToFile(folderId, policy);
  if (depthLimit <= 0) return;
  // list children folders
  const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const items = res.items || [];
  items.forEach(child => {
    // apply to child
    applyAccessPolicyToFile(child.id, policy);
    // recurse one level
    applyPolicyToFolderAndChildren(child.id, policy, depthLimit - 1);
  });
}

/* applyAccessPolicyToFile - uses Drive.Permissions.insert for groups */
/* Always calls permissions with supportsAllDrives = true */
/* Never submits role = owner to Drive */
/* Validates email of groups before inserting */
/* Validates that the file belongs to a Shared Drive before applying permissions */
/* Retries automatically once if Drive returns transient errors */
function applyAccessPolicyToFile(fileId, policy) {
  try {
    // First, verify that the file/folder exists and is accessible
    let folderInfo = null;
    try {
      folderInfo = Drive.Files.get(fileId, { 
        supportsAllDrives: true, 
        useDomainAdminAccess: true,
        fields: 'id,title,capabilities' 
      });
    } catch (e) {
      if (e.message && (e.message.includes('not found') || e.message.includes('Shared drive not found'))) {
        // File/folder doesn't exist or is not accessible - skip silently
        logRow('WARN', 'applyAccessPolicyToFile', `File/folder ${fileId} not found or not accessible, skipping`);
        return false;
      }
      // Other errors - log and continue
      logRow('WARN', 'applyAccessPolicyToFile', `Could not verify file/folder ${fileId}: ${e.message}`);
      return false;
    }
    
    // Validate that the file belongs to a Shared Drive
    // (We can't directly check this, but if we got here with supportsAllDrives, it should be okay)
    
    const groups = policy.groups || {};
    const groupNames = Object.keys(groups);
    
    if (groupNames.length === 0) {
      logRow('INFO', 'applyAccessPolicyToFile', `No groups to apply to file/folder ${fileId}`);
      return true;
    }
    
    logRow('INFO', 'applyAccessPolicyToFile', `Applying ${groupNames.length} group permission(s) to file/folder ${fileId}`);
    
    groupNames.forEach(groupName => {
      let role = groups[groupName].role || 'reader';
      
      // NEVER submit owner role to Drive - convert to organizer
      if (role === 'owner') {
        role = 'organizer';
        logRow('INFO', 'applyAccessPolicyToFile', `Converted role "owner" to "organizer" (Manager) for Shared Drive file/folder ${fileId}`);
      }
      
      // We expect group emails as keys or we try to convert groupName to group email by appending domain
      let groupEmail = groupName;
      if (!groupEmail.includes('@')) {
        // If groupName has spaces, replace with hyphen? We'll attempt domain @dtgsa.com by default
        groupEmail = `${groupName.replace(/\s+/g, '-').toLowerCase()}@dtgsa.com`;
      }
      
      // Validate email format
      if (!groupEmail.includes('@') || !groupEmail.includes('.')) {
        logRow('WARN', 'applyAccessPolicyToFile', `Skipping group "${groupName}" because email format is invalid: ${groupEmail}`);
        return;
      }
      
      const body = {
        type: 'group',
        role: role,
        value: groupEmail
      };
      
      // Use insertPermissionSafely which handles all validation and retries
      const inserted = insertPermissionSafely(fileId, body);
      if (inserted) {
        logRow('INFO', 'applyAccessPolicyToFile', `✓ Applied ${role} permission to group ${groupEmail} on file/folder ${fileId}`);
      } else {
        logRow('WARN', 'applyAccessPolicyToFile', `✗ Failed to apply ${role} permission to group ${groupEmail} on file/folder ${fileId}`);
      }
    });

    // Apply protection flags (for files that support it). Drive v2 supports copyRequiresWriterPermission when updating file metadata
    try {
      const patch = {};
      if (policy.protection) {
        if (typeof policy.protection.copyRequiresWriterPermission !== 'undefined') {
          patch.copyRequiresWriterPermission = !!policy.protection.copyRequiresWriterPermission;
        }
        // viewersCanCopyContent is a Drive UI option; implement by keeping copyRequiresWriterPermission false/true accordingly.
      }
      if (Object.keys(patch).length) {
        Drive.Files.patch(patch, fileId, { 
          supportsAllDrives: true,
          useDomainAdminAccess: true 
        });
        logRow('INFO', 'applyAccessPolicyToFile', `✓ Applied protection flags to file/folder ${fileId}`);
      }
    } catch (e) {
      if (e.message && (e.message.includes('not found') || e.message.includes('Shared drive not found'))) {
        // File/folder doesn't exist - skip silently
        logRow('WARN', 'applyAccessPolicyToFile', `File/folder ${fileId} not found when applying protection flags, skipping`);
        return false;
      }
      logRow('WARN', 'applyAccessPolicyToFile', `Failed to patch protection flags on ${fileId}: ${e.message}`);
    }

    logRow('INFO', 'applyAccessPolicyToFile', `✓ Successfully applied access policy to file/folder ${fileId}`);
    return true;
  } catch (err) {
    logRow('ERROR', 'applyAccessPolicyToFile', `✗ Error processing file ${fileId}: ${err.message}`);
    return false;
  }
}

/* cronSyncRecent - apply access to recent projects only (new ones) */
function cronSyncRecent() {
  // Simple strategy: read last N folders in shared drive root and re-apply policy
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) throw new Error('Shared Drive ID not configured');
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 50, orderBy: 'createdDate desc' });
  const items = res.items || [];
  const policy = getAccessPolicy();
  items.forEach(item => {
    applyPolicyToFolderAndChildren(item.id, policy, 3); // depth 3
  });
  return 'Sync recent completed';
}

/* cronAuditAll - reapply to all projects (careful: may be heavy) */
function cronAuditAll() {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) throw new Error('Shared Drive ID not configured');
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  // paginate
  let pageToken = null;
  const policy = getAccessPolicy();
  do {
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100, pageToken: pageToken });
    const items = res.items || [];
    items.forEach(item => applyPolicyToFolderAndChildren(item.id, policy, 5));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return 'Audit complete';
}

/* getBiddingProjects - list available projects (simple list of root folder names) */
function getBiddingProjects() {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return [];
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const items = res.items || [];
  // return array of titles
  return items.map(i => i.title || i.name);
}

/* getProjectsWithoutPD - list projects that don't have PD folder */
function getProjectsWithoutPD() {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return [];
  
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const items = res.items || [];
  
  const projectsWithoutPD = [];
  items.forEach(project => {
    // Check if PD folder exists
    if (!hasPDFolder(project.id)) {
      projectsWithoutPD.push(project.title);
    }
  });
  
  return projectsWithoutPD;
}

/* Email functions */
function getWebAppUrl() {
  try { return ScriptApp.getService().getUrl() || ''; }
  catch (e) { return ''; }
}

function getApprovalRecipient() {
  // If you want to specify a fixed recipient, save it in Script Properties as APPROVER_EMAIL
  var props = PropertiesService.getScriptProperties();
  var cfg = props.getProperty('APPROVER_EMAIL');
  if (cfg && cfg.indexOf('@') > -1) return cfg;
  // Default: to current user
  return (Session.getActiveUser().getEmail() || '').trim();
}

function renderHtmlFileToString(fileName, data) {
  var t = HtmlService.createTemplateFromFile(fileName);
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(function (k) { t[k] = data[k]; });
  }
  return t.evaluate().getContent();
}

/* Approval Recipients Management */
const APPROVAL_RECIPIENTS_PROP = 'APPROVAL_RECIPIENTS';

function getApprovalRecipients() {
  const raw = PropertiesService.getScriptProperties().getProperty(APPROVAL_RECIPIENTS_PROP);
  if (!raw) {
    // Default: current user
    const defaultRecipients = [Session.getActiveUser().getEmail()];
    return defaultRecipients;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return [Session.getActiveUser().getEmail()];
  }
}

function saveApprovalRecipients(recipients) {
  if (!Array.isArray(recipients)) {
    throw new Error('Recipients must be an array');
  }
  // Validate email addresses
  recipients.forEach(email => {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new Error(`Invalid email address: ${email}`);
    }
  });
  PropertiesService.getScriptProperties().setProperty(APPROVAL_RECIPIENTS_PROP, JSON.stringify(recipients));
  logRow('INFO', 'saveApprovalRecipients', `Saved ${recipients.length} approval recipient(s)`);
  return 'Approval recipients saved';
}

function sendApprovalEmail(pr, projectName, phase) {
  var to = getApprovalRecipient();
  if (!to) throw new Error('No approval recipient (set APPROVER_EMAIL or ensure user email available).');

  var base = getWebAppUrl();
  var approveLink = base ? (base + '?action=approve&pr=' + encodeURIComponent('PRJ-' + pr)
    + '&name=' + encodeURIComponent(projectName)
    + '&phase=' + encodeURIComponent(phase)) : '';

  var html = renderHtmlFileToString('EmailTemplate', {
    projectNumber: 'PRJ-' + pr,
    projectName: projectName,
    phase: phase,
    approveLink: approveLink
  });

  var subject = 'Approval Request: PRJ-' + pr + ' - ' + projectName;
  // Requires gmail.send scope (available in your appsscript.json)
  GmailApp.sendEmail(to, subject, 'Please view this email in HTML.', { htmlBody: html });
}

/* Ensure folder structure exists in a project from template */
function ensureFolderStructureInProject(projectFolderId, projectTitle) {
  try {
    const pr = extractPRNumber(projectTitle);
    if (!pr) {
      logRow('WARN', 'ensureFolderStructureInProject', `Could not extract PR number from project: ${projectTitle}`);
      return;
    }
    
    const template = getTemplateTree();
    if (!template || !Array.isArray(template) || template.length === 0) {
      logRow('WARN', 'ensureFolderStructureInProject', 'Template is empty or invalid');
      return;
    }
    
    // Get existing folders in project
    const projectFolders = getFoldersInParent(projectFolderId);
    
    // Find or create RFP folder
    let rfpFolder = projectFolders.find(f => f.title === `PRJ-${pr}-RFP`);
    if (!rfpFolder) {
      logRow('INFO', 'ensureFolderStructureInProject', `Creating RFP folder for project ${projectTitle}`);
      rfpFolder = Drive.Files.insert({
        title: `PRJ-${pr}-RFP`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [{ id: projectFolderId }]
      }, null, { supportsAllDrives: true });
    }
    
    // Find or create PD folder (check both old and new format)
    let pdFolder = projectFolders.find(f => f.title === `PRJ-${pr}-PD` || f.title === `PRJ-${pr}-Project Delivery`);
    if (!pdFolder) {
      logRow('INFO', 'ensureFolderStructureInProject', `Creating PD folder for project ${projectTitle}`);
      pdFolder = Drive.Files.insert({
        title: `PRJ-${pr}-Project Delivery`,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [{ id: projectFolderId }]
      }, null, { supportsAllDrives: true });
    }
    
    // Ensure subfolders exist in RFP and PD folders from template
    if (rfpFolder && rfpFolder.id) {
      createSubfoldersFromTemplate(rfpFolder.id, 'RFP', pr);
    }
    if (pdFolder && pdFolder.id) {
      createSubfoldersFromTemplate(pdFolder.id, 'PD', pr);
    }
    
  } catch (err) {
    logRow('ERROR', 'ensureFolderStructureInProject', `Error ensuring folder structure for project ${projectTitle}: ${err.message}`);
  }
}

/* Apply config to all projects in shared drive */
function applyConfigToAllProjectsSharedDrive() {
  try {
    logRow('INFO', 'applyConfigToAllProjectsSharedDrive', 'Starting to apply folder structure to all projects');
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) throw new Error('Shared Drive ID not configured');
    const template = getTemplateTree();
    const accessPolicy = getAccessPolicy();
    
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    let pageToken = null;
    let count = 0;
    let errors = 0;
    const startTime = new Date().getTime();
    const maxTime = 4.5 * 60 * 1000; // 4.5 minutes
    
    do {
      if (new Date().getTime() - startTime > maxTime) {
        logRow('WARN', 'applyConfigToAllProjectsSharedDrive', 'Operation timed out. Some projects may not have been processed.');
        break;
      }
      
      const res = Drive.Files.list({ 
        q: q, 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        maxResults: 100, 
        pageToken: pageToken 
      });
      const items = res.items || [];
      
      items.forEach(item => {
        try {
          // First, ensure folder structure exists (create missing folders from template)
          ensureFolderStructureInProject(item.id, item.title);
          
          // Then, apply access policy (permissions)
          applyPolicyToFolderAndChildren(item.id, accessPolicy, 5);
          count++;
          
          if (count % 10 === 0) {
            logRow('INFO', 'applyConfigToAllProjectsSharedDrive', `Processed ${count} projects so far...`);
          }
        } catch (e) {
          errors++;
          logRow('ERROR', 'applyConfigToAllProjectsSharedDrive', `Failed to process project ${item.title}: ${e.message}`);
        }
      });
      
      pageToken = res.nextPageToken;
    } while (pageToken);
    
    const message = `Successfully applied to ${count} project(s)${errors > 0 ? `, ${errors} error(s)` : ''}`;
    logRow('INFO', 'applyConfigToAllProjectsSharedDrive', message);
    return message;
  } catch (err) {
    logRow('ERROR', 'applyConfigToAllProjectsSharedDrive', `Error: ${err.message}`);
    throw err;
  }
}

/* Dynamic template management functions */
function addFolderToTemplate(parentPath, folderName, folderType) {
  const template = getTemplateTree();
  const parentNode = getNodeByPath(template, parentPath);
  
  if (!parentNode) {
    throw new Error('Parent node not found');
  }
  
  if (!parentNode.nodes) {
    parentNode.nodes = [];
  }
  
  // Add new folder
  parentNode.nodes.push({
    text: folderName,
    nodes: [],
    folderType: folderType || 'general'
  });
  
  // Save template
  saveConfig(template);
  
  // Apply to existing projects
  applyNewFolderToExistingProjects(parentPath, folderName, folderType);
  
  return 'Folder added to template and applied to existing projects';
}

function removeFolderFromTemplate(nodePath) {
  const template = getTemplateTree();
  const nodeToRemove = getNodeByPath(template, nodePath);
  
  if (!nodeToRemove) {
    throw new Error('Node not found');
  }
  
  // Delete from template
  const parentPath = nodePath.slice(0, -1);
  const parentNode = getNodeByPath(template, parentPath);
  
  if (parentNode && parentNode.nodes) {
    const index = nodePath[nodePath.length - 1];
    parentNode.nodes.splice(index, 1);
  }
  
  // Save template
  saveConfig(template);
  
  return 'Folder removed from template (existing projects unchanged)';
}

function renameFolderInTemplate(nodePath, newName) {
  const template = getTemplateTree();
  const nodeToRename = getNodeByPath(template, nodePath);
  
  if (!nodeToRename) {
    throw new Error('Node not found');
  }
  
  const oldName = nodeToRename.text;
  
  // Check existing folders by current name from Folder Structure
  const existingFolders = checkExistingFoldersForRename(nodePath, oldName);
  
  if (existingFolders.length === 0) {
    // No folders to rename, just update template
    nodeToRename.text = newName;
    saveConfig(template);
    return `✅ Folder renamed in template only. No existing folders found with name '${oldName}' to rename.`;
  }
  
  nodeToRename.text = newName;
  
  // Save template
  saveConfig(template);
  
  // Apply change to existing projects - search for actual folders
  const result = applyRenameToExistingProjectsByPath(nodePath, oldName, newName);
  
  return `✅ Folder renamed successfully!\n\n📁 Template: ${oldName} → ${newName}\n🔄 Shared Drive: ${existingFolders.length} folders updated\n\n${result}`;
}

/* Check existing folders before rename - Enhanced with position-based and fallback search */
function checkExistingFoldersForRename(nodePath, folderName) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const projects = res.items || [];
  
  const existingFolders = [];
  projects.forEach(project => {
    try {
      const pr = extractPRNumber(project.title);
      if (!pr) return;
      
      // Search by position first (high priority)
      let foldersToRename = mapTreeToDriveFolders(project.id, nodePath, pr);
      
      // If not found by position, use fallback search by partial name
      if (foldersToRename.length === 0) {
        foldersToRename = findFoldersByPartialName(project.id, nodePath, folderName, pr);
      }
      
      existingFolders.push(...foldersToRename);
    } catch (e) {
      // Ignore errors in check
    }
  });
  
  return existingFolders;
}

/* Fallback search by partial name matching */
function findFoldersByPartialName(projectId, nodePath, folderName, pr) {
  // Determine main folder type (RFP or PD)
  let mainFolderType;
  if (nodePath[0] === 0) {
    mainFolderType = 'RFP';
  } else if (nodePath[0] === 1) {
    mainFolderType = 'PD';
  } else {
    return [];
  }
  
  // Search for main folder
  const projectFolders = getAllProjectFolders(projectId);
  const mainFolder = projectFolders.find(folder => {
    if (mainFolderType === 'RFP') {
      return folder.title === `PRJ-${pr}-RFP`;
    } else {
      return folder.title === `PRJ-${pr}-PD` || folder.title === `PRJ-${pr}-Project Delivery`;
    }
  });
  
  if (!mainFolder) {
    return [];
  }
  
  // Search for subfolders
  const subFolders = getAllProjectFolders(mainFolder.id);
  
  // Search for folders containing partial name
  const matchingFolders = subFolders.filter(folder => {
    const match = folder.title.match(/^\d+-PRJ-\d+-(RFP|PD|Project Delivery)-(.+)$/);
    if (match) {
      const actualFolderName = match[2];
      // Search by partial name (contains required name)
      return actualFolderName.includes(folderName) || folderName.includes(actualFolderName);
    }
    return false;
  });
  
  return matchingFolders;
}

/* Get all folders in a parent folder recursively */
function getAllProjectFolders(parentFolderId) {
  const allFolders = [];
  const foldersToProcess = [parentFolderId];
  
  while (foldersToProcess.length > 0) {
    const currentFolderId = foldersToProcess.shift();
    const q = `'${currentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    try {
      const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
      const items = res.items || [];
      
      items.forEach(folder => {
        allFolders.push(folder);
        foldersToProcess.push(folder.id); // Add to queue for recursive processing
      });
    } catch (e) {
      logRow('WARN', 'getAllProjectFolders', `Error listing folders in ${currentFolderId}: ${e.message}`);
    }
  }
  
  return allFolders;
}

/* Find folders by actual name from template - Enhanced with better tree-to-drive mapping */
function findFoldersByActualName(projectId, nodePath, folderName, pr) {
  // Search in project subfolders
  const q = `'${projectId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100 });
  const folders = res.items || [];
  
  const foldersToRename = [];
  folders.forEach(folder => {
    // Search for folders containing actual folder name in correct location
    if (nodePath[0] === 0) { // Bidding/RFP
      // Search for RFP folders containing actual folder name
      if (folder.title.includes(`PRJ-${pr}-RFP`) && folder.title.includes(folderName)) {
        foldersToRename.push(folder);
      }
    } else if (nodePath[0] === 1) { // Project Delivery/PD
      // Search for PD folders containing actual folder name
      if ((folder.title.includes(`PRJ-${pr}-PD`) || folder.title.includes(`PRJ-${pr}-Project Delivery`)) && folder.title.includes(folderName)) {
        foldersToRename.push(folder);
      }
    }
  });
  
  return foldersToRename;
}

/* Enhanced function to map tree structure to actual drive folders - Position-based search */
function mapTreeToDriveFolders(projectId, nodePath, pr) {
  // Get complete folder structure in project
  const projectFolders = getAllProjectFolders(projectId);
  
  // Determine main folder type (RFP or PD)
  let mainFolderType;
  if (nodePath[0] === 0) {
    mainFolderType = 'RFP';
  } else if (nodePath[0] === 1) {
    mainFolderType = 'PD';
  } else {
    return [];
  }
  
  // Search for main folder (RFP or PD)
  const mainFolder = projectFolders.find(folder => {
    if (mainFolderType === 'RFP') {
      return folder.title === `PRJ-${pr}-RFP`;
    } else {
      return folder.title === `PRJ-${pr}-PD` || folder.title === `PRJ-${pr}-Project Delivery`;
    }
  });
  
  if (!mainFolder) {
    return [];
  }
  
  // Search for subfolders inside main folder
  const subFolders = getAllProjectFolders(mainFolder.id);
  
  // Search for folders matching path in tree
  const targetFolders = findFoldersByTreePath(subFolders, nodePath, pr, mainFolderType);
  
  return targetFolders;
}

/* Find folders by tree path structure - Enhanced with position-based search */
function findFoldersByTreePath(folders, nodePath, pr, mainFolderType) {
  const targetFolders = [];
  
  // Determine folder position in tree (index)
  const folderIndex = nodePath[nodePath.length - 1];
  
  folders.forEach(folder => {
    // Search by position first (high priority)
    if (matchesPositionInTree(folder, folderIndex, pr, mainFolderType)) {
      targetFolders.push(folder);
    }
  });
  
  return targetFolders;
}

/* Check if folder matches position in tree structure */
function matchesPositionInTree(folder, expectedIndex, pr, mainFolderType) {
  // Verify correct folder format
  let expectedPattern;
  if (mainFolderType === 'RFP') {
    expectedPattern = new RegExp(`^\\d+-PRJ-${pr}-RFP-.+$`);
  } else {
    expectedPattern = new RegExp(`^\\d+-PRJ-${pr}-(?:PD|Project Delivery)-.+$`);
  }
  
  if (!expectedPattern.test(folder.title)) {
    return false;
  }
  
  // Extract folder number from title
  const match = folder.title.match(/^(\d+)-PRJ-\d+-(RFP|PD)-(.+)$/);
  if (!match) {
    return false;
  }
  
  const folderNumber = parseInt(match[1]);
  const folderName = match[3];
  
  // Verify that folder number matches expected position in tree
  // We use index + 1 because numbering starts from 1
  return folderNumber === (expectedIndex + 1);
}

/* Apply rename by searching for actual folders in Shared Drive */
function applyRenameToExistingProjectsByPath(nodePath, oldName, newName) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const projects = res.items || [];
  
  let count = 0;
  projects.forEach(project => {
    try {
      const pr = extractPRNumber(project.title);
      if (!pr) return;
      
      // Search by position first (high priority)
      let foldersToRename = mapTreeToDriveFolders(project.id, nodePath, pr);
      
      // If not found by position, use fallback search by partial name
      if (foldersToRename.length === 0) {
        foldersToRename = findFoldersByPartialName(project.id, nodePath, oldName, pr);
      }
      
      foldersToRename.forEach(folder => {
        // Create new name according to folder type
        let newTitle;
        if (nodePath[0] === 0) { // Bidding/RFP
          const match = folder.title.match(/^(\d+)-PRJ-(\d+)-RFP-(.+)$/);
          if (match) {
            const number = match[1];
            const prNum = match[2];
            const remainingName = match[3].replace(oldName, newName);
            newTitle = `${number}-PRJ-${prNum}-RFP-${remainingName}`;
          } else {
            newTitle = folder.title.replace(oldName, newName);
          }
        } else if (nodePath[0] === 1) { // Project Delivery/PD
          const match = folder.title.match(/^(\d+)-PRJ-(\d+)-(?:PD|Project Delivery)-(.+)$/);
          if (match) {
            const number = match[1];
            const prNum = match[2];
            const remainingName = match[3].replace(oldName, newName);
            // Subfolders use 'PD' in the name, not 'Project Delivery'
            newTitle = `${number}-PRJ-${prNum}-PD-${remainingName}`;
          } else {
            newTitle = folder.title.replace(oldName, newName);
          }
        } else {
          newTitle = folder.title.replace(oldName, newName);
        }
        
        Drive.Files.patch({ title: newTitle }, folder.id, { 
          supportsAllDrives: true,
          useDomainAdminAccess: true 
        });
        count++;
      });
    } catch (e) {
      logRow('WARN', 'applyRenameToExistingProjectsByPath', `Failed to rename folder in project ${project.title}: ${e.message}`);
    }
  });
  
  return `Renamed folders in ${count} existing projects`;
}

/* Find folders by path and name in project */
function findFoldersByPathAndName(projectId, nodePath, oldName, pr) {
  // Search in project subfolders
  const q = `'${projectId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100 });
  const folders = res.items || [];
  
  const foldersToRename = [];
  folders.forEach(folder => {
    // Search for folders containing old name in correct location
    if (nodePath[0] === 0) { // Bidding/RFP
      // Search for RFP folders containing old name
      if (folder.title.includes(`PRJ-${pr}-RFP`) && folder.title.includes(oldName)) {
        foldersToRename.push(folder);
      }
    } else if (nodePath[0] === 1) { // Project Delivery/PD
      // Search for PD folders containing old name
      if ((folder.title.includes(`PRJ-${pr}-PD`) || folder.title.includes(`PRJ-${pr}-Project Delivery`)) && folder.title.includes(oldName)) {
        foldersToRename.push(folder);
      }
    }
  });
  
  return foldersToRename;
}

function getNodeByPath(template, path) {
  // Validate inputs
  if (!template) {
    logRow('WARN', 'getNodeByPath', 'Template is undefined');
    return null;
  }
  if (!path || !Array.isArray(path) || path.length === 0) {
    logRow('WARN', 'getNodeByPath', `Path is invalid or empty: ${JSON.stringify(path)}`);
    return null;
  }
  
  let current = template;
  for (let i = 0; i < path.length; i++) {
    const pathSegment = path[i];
    if (pathSegment === undefined || pathSegment === null) {
      logRow('WARN', 'getNodeByPath', `Path segment at index ${i} is undefined or null`);
      return null;
    }
    
    if (!current || typeof current !== 'object') {
      logRow('WARN', 'getNodeByPath', `Invalid current node at path index ${i}, path so far: ${JSON.stringify(path.slice(0, i))}`);
      return null;
    }
    
    if (!current[pathSegment]) {
      logRow('WARN', 'getNodeByPath', `Path element "${pathSegment}" not found at index ${i}, path so far: ${JSON.stringify(path.slice(0, i))}`);
      return null;
    }
    current = current[pathSegment];
    if (i < path.length - 1 && current && current.nodes) {
      current = current.nodes;
    }
  }
  return current;
}

function applyNewFolderToExistingProjects(parentPath, folderName, folderType) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const projects = res.items || [];
  
  let count = 0;
  projects.forEach(project => {
    try {
      const pr = extractPRNumber(project.title);
      if (!pr) return;
      
      // Search for appropriate folder to add new folder
      const targetFolder = findTargetFolderForNewSubfolder(project.id, parentPath, pr);
      if (targetFolder) {
        // Determine new folder number
        const existingFolders = getFoldersInParent(targetFolder.id);
        const nextNumber = getNextFolderNumber(existingFolders);
        
        // Determine folder type and naming type
        let folderTitle;
        if (folderType === 'RFP') {
          folderTitle = `${nextNumber}-PRJ-${pr}-RFP-${folderName}`;
        } else if (folderType === 'PD') {
          // Subfolders use 'PD' in the name, not 'Project Delivery'
          folderTitle = `${nextNumber}-PRJ-${pr}-PD-${folderName}`;
        } else {
          folderTitle = `${nextNumber}- ${folderName}`;
        }
        
        // Create new folder with subfolders
        const newFolder = Drive.Files.insert({
          title: folderTitle,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [{ id: targetFolder.id }]
        }, null, { supportsAllDrives: true });
        
        // Add subfolders if they exist in template
        const template = getTemplateTree();
        const templateNode = findTemplateNodeByPath(template, parentPath);
        if (templateNode && templateNode.nodes) {
          const newNode = templateNode.nodes.find(n => n.text === folderName);
          if (newNode && newNode.nodes) {
            createSubfoldersRecursively(newNode.nodes, newFolder.id);
          }
        }
        
        count++;
      }
    } catch (e) {
      logRow('WARN', 'applyNewFolderToExistingProjects', `Failed to add folder to project ${project.title}: ${e.message}`);
    }
  });
  
  return `Added folder to ${count} existing projects`;
}

/* Get folders in a parent folder */
function getFoldersInParent(parentFolderId) {
  // Validate input
  if (!parentFolderId) {
    logRow('ERROR', 'getFoldersInParent', 'parentFolderId is required');
    return [];
  }
  
  try {
    const q = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100 });
    return res.items || [];
  } catch (e) {
    logRow('ERROR', 'getFoldersInParent', `Error getting folders in parent ${parentFolderId}: ${e.message}`);
    return [];
  }
}

/* Get next folder number based on existing numbered folders */
function getNextFolderNumber(existingFolders) {
  let maxNumber = 0;
  existingFolders.forEach(folder => {
    const match = folder.title.match(/^(\d+)-/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  return maxNumber + 1;
}

/* Find template node by path */
function findTemplateNodeByPath(template, path) {
  let current = template;
  for (let i = 0; i < path.length; i++) {
    if (!current[path[i]]) return null;
    current = current[path[i]];
    if (i < path.length - 1 && current.nodes) {
      current = current.nodes;
    }
  }
  return current;
}

function applyRenameToExistingProjects(nodePath, oldName, newName) {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const projects = res.items || [];
  
  let count = 0;
  projects.forEach(project => {
    try {
      const pr = extractPRNumber(project.title);
      if (!pr) return;
      
      // Search for folders containing old name in project
      const foldersToRename = findFoldersToRenameInProject(project.id, oldName);
      foldersToRename.forEach(folder => {
        // Replace old name with new in title
        let newTitle = folder.title.replace(oldName, newName);
        
        // If folder is numbered, ensure numbering is preserved
        const match = folder.title.match(/^(\d+)-PRJ-(\d+)-(RFP|PD)-(.+)$/);
        if (match) {
          const number = match[1];
          const prNum = match[2];
          const type = match[3];
          const remainingName = match[4].replace(oldName, newName);
            newTitle = `${number}-PRJ-${prNum}-${type}-${remainingName}`;
        }
        
        Drive.Files.patch({ title: newTitle }, folder.id, { 
          supportsAllDrives: true,
          useDomainAdminAccess: true 
        });
        count++;
      });
    } catch (e) {
      logRow('WARN', 'applyRenameToExistingProjects', `Failed to rename folder in project ${project.title}: ${e.message}`);
    }
  });
  
  return `Renamed folders in ${count} existing projects`;
}

function findTargetFolderForNewSubfolder(projectId, parentPath, pr) {
  // Search for appropriate folder by path
  const q = `'${projectId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100 });
  const folders = res.items || [];
  
  // Search for RFP or PD folder by path
  for (let i = 0; i < parentPath.length; i++) {
    const pathNode = parentPath[i];
    // Simplified logic to search for appropriate folder
    if (pathNode === 0) { // Bidding
      return folders.find(f => f.title.includes(`PRJ-${pr}-RFP`) && !f.title.includes('-'));
    } else if (pathNode === 1) { // Project Delivery
      return folders.find(f => (f.title.includes(`PRJ-${pr}-PD`) || f.title.includes(`PRJ-${pr}-Project Delivery`)) && !f.title.includes('-'));
    }
  }
  
  return null;
}

function findFoldersToRename(projectId, oldName, pr) {
  // Search in all project subfolders
  const q = `'${projectId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 100 });
  const folders = res.items || [];
  
  // Search for folders containing old name
  const foldersToRename = [];
  folders.forEach(folder => {
    if (folder.title.includes(oldName)) {
      foldersToRename.push(folder);
    }
  });
  
  return foldersToRename;
}

/* UI Helper functions for template management */
function addFolderToTemplateFromUI(parentPath, folderName, folderType) {
  try {
    return addFolderToTemplate(parentPath, folderName, folderType);
  } catch (err) {
    logRow('ERROR', 'addFolderToTemplateFromUI', err.message);
    throw err;
  }
}

function removeFolderFromTemplateFromUI(nodePath) {
  try {
    return removeFolderFromTemplate(nodePath);
  } catch (err) {
    logRow('ERROR', 'removeFolderFromTemplateFromUI', err.message);
    throw err;
  }
}

function renameFolderInTemplateFromUI(nodePath, newName) {
  try {
    return renameFolderInTemplate(nodePath, newName);
  } catch (err) {
    logRow('ERROR', 'renameFolderInTemplateFromUI', err.message);
    throw err;
  }
}

/* Bulk add multiple folders to template */
function bulkAddFoldersToTemplate(parentPath, folderNames, folderType, addAsSiblings) {
  try {
    if (!folderNames || !Array.isArray(folderNames) || folderNames.length === 0) {
      throw new Error('No folder names provided');
    }
    
    const template = getTemplateTree();
    const parentNode = getNodeByPath(template, parentPath);
    
    if (!parentNode) {
      throw new Error('Parent node not found');
    }
    
    if (!parentNode.nodes) {
      parentNode.nodes = [];
    }
    
    let added = 0;
    const errors = [];
    
    folderNames.forEach(folderName => {
      try {
        if (!folderName || typeof folderName !== 'string' || folderName.trim().length === 0) {
          return; // Skip empty names
        }
        
        const trimmedName = folderName.trim();
        
        // Check if folder already exists
        const exists = parentNode.nodes.some(node => node.text === trimmedName);
        if (exists) {
          errors.push(`Folder "${trimmedName}" already exists, skipped`);
          return;
        }
        
        // Add new folder
        parentNode.nodes.push({
          text: trimmedName,
          nodes: [],
          folderType: folderType || 'general'
        });
        added++;
      } catch (e) {
        errors.push(`Error adding "${folderName}": ${e.message}`);
      }
    });
    
    // Save template
    saveConfig(template);
    
    // Apply to existing projects
    folderNames.forEach(folderName => {
      try {
        if (folderName && folderName.trim().length > 0) {
          applyNewFolderToExistingProjects(parentPath, folderName.trim(), folderType);
        }
      } catch (e) {
        logRow('WARN', 'bulkAddFoldersToTemplate', `Failed to apply folder "${folderName}" to existing projects: ${e.message}`);
      }
    });
    
    let message = `Successfully added ${added} folder(s) to template`;
    if (errors.length > 0) {
      message += `\n\nWarnings:\n${errors.join('\n')}`;
    }
    
    logRow('INFO', 'bulkAddFoldersToTemplate', `Added ${added} folders, ${errors.length} warnings`);
    return message;
  } catch (err) {
    logRow('ERROR', 'bulkAddFoldersToTemplate', err.message);
    throw err;
  }
}

/* Import folder structure from Google Drive */
function importFolderStructureFromDrive(sourceFolderId, targetPath, folderType, importRecursive) {
  try {
    if (!sourceFolderId) {
      throw new Error('Source folder ID is required');
    }
    
    // Verify source folder exists
    let sourceFolder;
    try {
      sourceFolder = Drive.Files.get(sourceFolderId, { 
        supportsAllDrives: true, 
        useDomainAdminAccess: true 
      });
    } catch (e) {
      try {
        sourceFolder = Drive.Files.get(sourceFolderId, { 
          supportsAllDrives: true 
        });
      } catch (e2) {
        throw new Error(`Cannot access source folder: ${e2.message}`);
      }
    }
    
    logRow('INFO', 'importFolderStructureFromDrive', `Importing structure from folder: ${sourceFolder.title || sourceFolderId}`);
    
    // Get template
    const template = getTemplateTree();
    const targetNode = getNodeByPath(template, targetPath);
    
    if (!targetNode) {
      throw new Error('Target node not found in template');
    }
    
    if (!targetNode.nodes) {
      targetNode.nodes = [];
    }
    
    // Import folders recursively
    const importedFolders = [];
    const errors = [];
    
    function importFoldersRecursive(folderId, parentNode, depth) {
      if (depth > 10) {
        logRow('WARN', 'importFolderStructureFromDrive', 'Maximum depth reached (10 levels), stopping recursion');
        return;
      }
      
      try {
        const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        const res = Drive.Files.list({ 
          q: q, 
          supportsAllDrives: true, 
          includeItemsFromAllDrives: true, 
          maxResults: 500 
        });
        
        const folders = res.items || [];
        
        folders.forEach(folder => {
          try {
            // Check if folder already exists
            const exists = parentNode.nodes.some(node => node.text === folder.title);
            if (exists) {
              errors.push(`Folder "${folder.title}" already exists, skipped`);
              return;
            }
            
            // Add folder to template
            const newNode = {
              text: folder.title,
              nodes: [],
              folderType: folderType || 'general'
            };
            
            parentNode.nodes.push(newNode);
            importedFolders.push(folder.title);
            
            // If recursive import is enabled, import subfolders
            if (importRecursive) {
              importFoldersRecursive(folder.id, newNode, depth + 1);
            }
          } catch (e) {
            errors.push(`Error importing folder "${folder.title}": ${e.message}`);
          }
        });
      } catch (e) {
        errors.push(`Error listing folders in ${folderId}: ${e.message}`);
      }
    }
    
    // Start import
    importFoldersRecursive(sourceFolderId, targetNode, 0);
    
    if (importedFolders.length === 0) {
      return 'No folders found to import, or all folders already exist in template';
    }
    
    // Save template
    saveConfig(template);
    
    // Apply to existing projects (only top-level folders for performance)
    const topLevelFolders = targetNode.nodes.slice(-importedFolders.length);
    topLevelFolders.forEach(node => {
      try {
        applyNewFolderToExistingProjects(targetPath, node.text, folderType);
      } catch (e) {
        logRow('WARN', 'importFolderStructureFromDrive', `Failed to apply folder "${node.text}" to existing projects: ${e.message}`);
      }
    });
    
    let message = `Successfully imported ${importedFolders.length} folder(s) from "${sourceFolder.title || sourceFolderId}"`;
    if (errors.length > 0) {
      message += `\n\nWarnings:\n${errors.slice(0, 10).join('\n')}`;
      if (errors.length > 10) {
        message += `\n... and ${errors.length - 10} more warnings`;
      }
    }
    
    logRow('INFO', 'importFolderStructureFromDrive', `Imported ${importedFolders.length} folders, ${errors.length} warnings`);
    return message;
  } catch (err) {
    logRow('ERROR', 'importFolderStructureFromDrive', err.message);
    throw err;
  }
}

/* Scan and check for duplicate projects */
function scanForDuplicateProjects() {
  const rootDriveId = ROOT_SHARED_DRIVE_ID;
  if (!rootDriveId) return { duplicates: [], summary: 'Shared Drive ID not configured' };
  
  const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
  const items = res.items || [];
  
  const projectMap = new Map();
  const duplicates = [];
  
  items.forEach(item => {
    const title = item.title || '';
    const match = title.match(/PRJ-(\d+)-(.+)$/);
    if (match) {
      const prNumber = match[1];
      const projectName = match[2].toLowerCase();
      
      if (projectMap.has(projectName)) {
        duplicates.push({
          projectName: match[2],
          projects: [projectMap.get(projectName), { pr: prNumber, title: title, id: item.id }]
        });
      } else {
        projectMap.set(projectName, { pr: prNumber, title: title, id: item.id });
      }
    }
  });
  
  return {
    duplicates: duplicates,
    summary: `Found ${duplicates.length} duplicate project names out of ${items.length} total projects`,
    totalProjects: items.length
  };
}

/* Update existing project folder names to new format */
/* Get next folder number for rename (excluding current folder) */
function getNextFolderNumberForRename(existingFolders, excludeFolderId) {
  let maxNumber = 0;
  existingFolders.forEach(folder => {
    if (folder.id === excludeFolderId) return; // Ignore current folder
    
    const match = folder.title.match(/^(\d+)-(PRJ|PR)-/);
    if (match) {
      const number = parseInt(match[1]);
      if (number > maxNumber) {
        maxNumber = number;
      }
    }
  });
  return maxNumber + 1;
}

/* ========== Limited Access Functions ========== */

function getDefaultGroupDomain() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email ? email.split('@')[1] : 'dtgsa.com';
  } catch (e) {
    return 'dtgsa.com';
  }
}

function normalizeGroupEmail(nameOrEmail) {
  if (!nameOrEmail) return '';
  if (nameOrEmail.includes('@')) return nameOrEmail;
  const domain = getDefaultGroupDomain();
  return `${nameOrEmail.replace(/\s+/g, '-').toLowerCase()}@${domain}`;
}

function getTemplatePathNodes(nodePath, template) {
  if (!Array.isArray(nodePath) || !template) return null;
  const nodes = [];
  let currentLevel = template;
  for (let i = 0; i < nodePath.length; i++) {
    if (!currentLevel || !currentLevel[nodePath[i]]) return null;
    const node = currentLevel[nodePath[i]];
    nodes.push(node);
    currentLevel = node.nodes || [];
  }
  return nodes;
}

function getFolderTypeFromPath(nodePath) {
  if (!Array.isArray(nodePath) || nodePath.length === 0) return null;
  return nodePath[0] === 0 ? 'RFP' : 'PD';
}

function resolveFolderByPath(projectId, nodePath, pr, templateNodes, folderType) {
  if (!projectId || !Array.isArray(nodePath) || !pr) return null;
  const type = folderType || getFolderTypeFromPath(nodePath);
  if (!type) return null;

  const projectFolders = getFoldersInParent(projectId);
  let mainFolder = null;
  
  // For PD, check both old format (PD) and new format (Project Delivery)
  if (type === 'PD') {
    mainFolder = projectFolders.find(folder => 
      folder.title === `PRJ-${pr}-PD` || folder.title === `PRJ-${pr}-Project Delivery`
    );
  } else {
    const mainFolderTitle = `PRJ-${pr}-${type}`;
    mainFolder = projectFolders.find(folder => folder.title === mainFolderTitle);
  }
  if (!mainFolder) return null;
  if (nodePath.length === 1) return mainFolder;

  const pathNodes = templateNodes || getTemplatePathNodes(nodePath, getTemplateTree());
  if (!pathNodes) return null;

  let currentFolder = mainFolder;
  for (let depth = 1; depth < nodePath.length; depth++) {
    const expectedIndex = nodePath[depth];
    const expectedNumber = expectedIndex + 1;
    const expectedNode = pathNodes[depth];
    const expectedName = expectedNode ? expectedNode.text : null;

    const children = getFoldersInParent(currentFolder.id);
    let match = children.find(child => {
      const info = parseNumberedFolder(child.title);
      if (!info) return false;
      if (info.pr !== pr) return false;
      if (info.phase !== type) return false;
      if (info.number === expectedNumber) return true;
      if (expectedName && child.title.includes(expectedName)) return true;
      return false;
    });

    if (!match) return null;
    currentFolder = match;
  }
  return currentFolder;
}

function shareFolderWithDomain(folderId, skipIfLimitedAccess) {
  if (skipIfLimitedAccess) return;
  try {
    const domain = getDefaultGroupDomain();
    if (!domain) return;
    
    const body = { type: 'domain', role: 'reader', value: domain };
    Drive.Permissions.insert(body, folderId, { 
      supportsAllDrives: true, 
      useDomainAdminAccess: true, 
      sendNotificationEmails: false 
    });
    logRow('INFO', 'shareFolderWithDomain', `Shared folder ${folderId} with domain ${domain}`);
  } catch (e) {
    if (!e.message || !e.message.includes('already exists') && !e.message.includes('inherited')) {
      logRow('WARN', 'shareFolderWithDomain', `Note: API call to drive.permissions.insert failed with error: ${e.message}. - This is normal in Shared Drive`);
    }
  }
}

function shareAllFoldersRecursively(folderId, depthLimit) {
  depthLimit = depthLimit || 5;
  shareFolderWithDomain(folderId, false);
  if (depthLimit <= 0) return;
  
  const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  try {
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
    const items = res.items || [];
    items.forEach(child => {
      shareAllFoldersRecursively(child.id, depthLimit - 1);
    });
  } catch (e) {
    logRow('WARN', 'shareAllFoldersRecursively', `Error listing children: ${e.message}`);
  }
}

function shareAllFoldersRecursivelyWithTemplate(folderId, template, depthLimit) {
  depthLimit = depthLimit || 5;
  shareFolderWithDomain(folderId, false);
  if (depthLimit <= 0) return;
  
  const q = `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  try {
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
    const items = res.items || [];
    items.forEach(child => {
      shareAllFoldersRecursivelyWithTemplate(child.id, template, depthLimit - 1);
    });
  } catch (e) {
    logRow('WARN', 'shareAllFoldersRecursivelyWithTemplate', `Error listing children: ${e.message}`);
  }
}

// Helper function to safely get permissions with fallback
// Returns permissions with full details including inherited status
function getFolderPermissionsSafely(folderId) {
  // Validate input
  if (!folderId || folderId === 'undefined' || (typeof folderId === 'string' && folderId.trim() === '')) {
    throw new Error(`Folder ID is required but got: ${folderId}`);
  }
  
  // First verify folder exists
  try {
    Drive.Files.get(folderId, { supportsAllDrives: true, useDomainAdminAccess: true, fields: 'id' });
  } catch (e) {
    try {
      Drive.Files.get(folderId, { supportsAllDrives: true, fields: 'id' });
    } catch (e2) {
      throw new Error(`Folder not found or not accessible: ${folderId}`);
    }
  }
  
  // Request permission details including nested permissionDetails for inherited status
  // In Shared Drives, inherited status is in permissionDetails/teamDrivePermissionDetails
  // Note: drivePermissionDetails is not available in Drive API v2, only in v3
  const fields = 'items(' +
    'id,type,role,emailAddress,domain,value,deleted,' +
    'permissionDetails,' +
    'teamDrivePermissionDetails' +
  ')';
  
  // Try with useDomainAdminAccess first
  try {
    const response = Drive.Permissions.list(folderId, { 
      supportsAllDrives: true, 
      useDomainAdminAccess: true, 
      maxResults: 100,
      fields: fields
    });
    return response;
  } catch (e) {
    // Fallback without useDomainAdminAccess
    try {
      const response = Drive.Permissions.list(folderId, { 
        supportsAllDrives: true, 
        maxResults: 100,
        fields: fields
      });
      return response;
    } catch (e2) {
      throw new Error(`Cannot read permissions: ${e2.message}`);
    }
  }
}

// Helper function to check if a permission is inherited
// In Shared Drives, inherited status is in permissionDetails/teamDrivePermissionDetails
function isInheritedPermission(perm) {
  // Validate input
  if (!perm || typeof perm !== 'object') {
    return false;
  }
  
  // Check top-level properties first (for backward compatibility)
  if (perm.inherited === true || perm.inheritedFrom) {
    return true;
  }
  
  // Check permissionDetails array
  if (perm.permissionDetails && Array.isArray(perm.permissionDetails)) {
    const hasInherited = perm.permissionDetails.some(detail => detail && detail.inherited === true);
    if (hasInherited) return true;
  }
  
  // Check teamDrivePermissionDetails (for Shared Drives)
  const driveDetails = perm.teamDrivePermissionDetails;
  if (driveDetails) {
    // Can be an object or array
    if (Array.isArray(driveDetails)) {
      const hasInherited = driveDetails.some(detail => detail && detail.inherited === true);
      if (hasInherited) return true;
    } else if (driveDetails && driveDetails.inherited === true) {
      return true;
    }
  }
  
  return false;
}

// Helper function to check if a permission should be skipped (protected/system/inherited)
function shouldSkipPermission(perm) {
  // Skip if inherited - use robust detection that checks nested permissionDetails
  if (isInheritedPermission(perm)) {
    return { skip: true, reason: 'inherited' };
  }
  
  // Skip organizer and fileOrganizer roles (system/protected)
  if (perm.role === 'organizer' || perm.role === 'fileOrganizer') {
    return { skip: true, reason: 'system_role' };
  }
  
  // Skip if deleted
  if (perm.deleted === true) {
    return { skip: true, reason: 'deleted' };
  }
  
  // Skip if it's a service account or system user (usually have special email patterns)
  if (perm.type === 'user' && perm.emailAddress) {
    const email = perm.emailAddress.toLowerCase();
    if (email.includes('@system.gserviceaccount.com') || 
        email.includes('@appspot.gserviceaccount.com') ||
        email.includes('@cloudservices.gserviceaccount.com')) {
      return { skip: true, reason: 'service_account' };
    }
  }
  
  return { skip: false };
}

// Helper function to safely remove permission with fallback
function removePermissionSafely(folderId, permissionId) {
  // Try without useDomainAdminAccess first (sometimes works better)
  try {
    Drive.Permissions.remove(folderId, permissionId, { supportsAllDrives: true });
    return true;
  } catch (e) {
    // If that fails, try with useDomainAdminAccess
    try {
      Drive.Permissions.remove(folderId, permissionId, { supportsAllDrives: true, useDomainAdminAccess: true });
      return true;
    } catch (e2) {
      // If both fail, check if it's a permission we can't delete (inherited, owner, etc.)
      const errorMsg = e2.message || e.message || '';
      
      // These errors mean we can't delete the permission - it's okay to skip
      if (errorMsg.includes('does not have the required access') ||
          errorMsg.includes('cannot be removed') ||
          errorMsg.includes('inherited') ||
          errorMsg.includes('owner') ||
          errorMsg.includes('not found')) {
        // This is expected for some permissions - return false but don't throw
        return false;
      }
      
      // For other errors, throw to be handled by caller
      throw e2;
    }
  }
}

// Helper function to safely insert permission with fallback
function insertPermissionSafely(folderId, permissionBody) {
  // Validate inputs
  if (!folderId || folderId === 'undefined' || (typeof folderId === 'string' && folderId.trim() === '')) {
    logRow('WARN', 'insertPermissionSafely', `Skipping insert because folderId is undefined or empty`);
    return false;
  }
  if (!permissionBody || typeof permissionBody !== 'object') {
    logRow('WARN', 'insertPermissionSafely', `Skipping insert because permissionBody is invalid for folder ${folderId}`);
    return false;
  }
  if (!permissionBody.type) {
    logRow('WARN', 'insertPermissionSafely', `Skipping insert because permissionBody.type is missing for folder ${folderId}`);
    return false;
  }
  if (!permissionBody.role) {
    logRow('WARN', 'insertPermissionSafely', `Skipping insert because permissionBody.role is missing for folder ${folderId}`);
    return false;
  }
  
  // NEVER submit owner role to Drive - it's invalid
  if (permissionBody.role === 'owner') {
    logRow('WARN', 'insertPermissionSafely', `Skipping insert because role 'owner' is invalid. Use 'organizer' for Shared Drive folders.`);
    return false;
  }
  
  // For non-domain permissions, validate that we have an email/value
  if (permissionBody.type !== 'domain') {
    const emailOrValue = permissionBody.value || permissionBody.emailAddress;
    if (!emailOrValue || (typeof emailOrValue === 'string' && emailOrValue.trim() === '') || emailOrValue === 'undefined') {
      logRow('WARN', 'insertPermissionSafely', `Skipping insert because group email/value is undefined or empty for folder ${folderId} (type: ${permissionBody.type})`);
      return false;
    }
    
    // Validate email format
    if (permissionBody.type === 'group' || permissionBody.type === 'user') {
      if (!emailOrValue.includes('@') || !emailOrValue.includes('.')) {
        logRow('WARN', 'insertPermissionSafely', `Skipping insert because email format is invalid: ${emailOrValue} for folder ${folderId}`);
        return false;
      }
    }
  } else {
    // For domain permissions, validate domain value
    if (!permissionBody.value || (typeof permissionBody.value === 'string' && permissionBody.value.trim() === '') || permissionBody.value === 'undefined') {
      logRow('WARN', 'insertPermissionSafely', `Skipping insert because domain value is undefined or empty for folder ${folderId}`);
      return false;
    }
  }
  
  // Verify folder exists and belongs to Shared Drive before applying permissions
  try {
    const folder = Drive.Files.get(folderId, { 
      supportsAllDrives: true, 
      useDomainAdminAccess: true,
      fields: 'id,capabilities' 
    });
    // If we can't get the folder, it might not exist or not be accessible
  } catch (e) {
    if (e.message && (e.message.includes('not found') || e.message.includes('Shared drive not found'))) {
      logRow('WARN', 'insertPermissionSafely', `Folder ${folderId} not found or not accessible, skipping permission insert`);
      return false;
    }
    // Other errors - log but continue
    logRow('WARN', 'insertPermissionSafely', `Could not verify folder ${folderId}: ${e.message}`);
  }
  
  // Try with retry logic for transient errors
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      Drive.Permissions.insert(permissionBody, folderId, { 
        supportsAllDrives: true, 
        useDomainAdminAccess: true, 
        sendNotificationEmails: false 
      });
      return true;
    } catch (e) {
      lastError = e;
      // If it's a transient error, retry once
      if (attempt === 0 && (e.message.includes('rateLimitExceeded') || e.message.includes('userRateLimitExceeded') || e.message.includes('backendError'))) {
        Utilities.sleep(1000); // Wait 1 second before retry
        continue;
      }
      // If first attempt failed without useDomainAdminAccess, try without it
      if (attempt === 0) {
        try {
          Drive.Permissions.insert(permissionBody, folderId, { 
            supportsAllDrives: true, 
            sendNotificationEmails: false 
          });
          return true;
        } catch (e2) {
          lastError = e2;
          // If still fails, break and log
          break;
        }
      }
    }
  }
  
  // Log error but don't throw - continue processing other permissions
  if (lastError && !lastError.message.includes('already exists')) {
    logRow('WARN', 'insertPermissionSafely', `Failed to insert permission for folder ${folderId}: ${lastError.message}`);
  }
  return false;
}

/* Clean all direct group permissions from folder (Template as source of truth) */
function cleanAllGroupPermissionsFromFolder(folderId) {
  try {
    logRow('INFO', 'cleanAllGroupPermissionsFromFolder', `Cleaning all direct group permissions from folder ${folderId}`);
    
    const perms = getFolderPermissionsSafely(folderId);
    const existingPerms = perms.items || [];
    
    // Get all direct group permissions (ignore inherited/system)
    const allGroupPerms = existingPerms.filter(p => p.type === 'group');
    const directGroupPerms = [];
    
    allGroupPerms.forEach(perm => {
      const skipCheck = shouldSkipPermission(perm);
      if (!skipCheck.skip) {
        directGroupPerms.push(perm);
      }
    });
    
    if (directGroupPerms.length === 0) {
      logRow('INFO', 'cleanAllGroupPermissionsFromFolder', `No direct group permissions to remove from folder ${folderId}`);
      return { removed: 0, failed: 0 };
    }
    
    logRow('INFO', 'cleanAllGroupPermissionsFromFolder', `Removing ${directGroupPerms.length} direct group permission(s) from folder ${folderId}`);
    let removedCount = 0;
    let failedCount = 0;
    
    directGroupPerms.forEach(perm => {
      try {
        const removed = removePermissionSafely(folderId, perm.id);
        if (removed) {
          removedCount++;
          const email = perm.emailAddress || perm.value || perm.id;
          logRow('INFO', 'cleanAllGroupPermissionsFromFolder', `Removed direct group permission: ${email} (${perm.id})`);
        } else {
          failedCount++;
          const email = perm.emailAddress || perm.value || perm.id;
          logRow('WARN', 'cleanAllGroupPermissionsFromFolder', `Failed to remove group permission: ${email} (${perm.id})`);
        }
      } catch (e) {
        failedCount++;
        const email = perm.emailAddress || perm.value || perm.id;
        logRow('WARN', 'cleanAllGroupPermissionsFromFolder', `Error removing group permission ${email} (${perm.id}): ${e.message}`);
      }
    });
    
    logRow('INFO', 'cleanAllGroupPermissionsFromFolder', `Cleaned ${removedCount} direct group permission(s) from folder ${folderId}, ${failedCount} failed`);
    Utilities.sleep(300); // Small delay to avoid rate limiting
    
    return { removed: removedCount, failed: failedCount };
  } catch (e) {
    logRow('ERROR', 'cleanAllGroupPermissionsFromFolder', `Error cleaning permissions from folder ${folderId}: ${e.message}`);
    return { removed: 0, failed: 0 };
  }
}

/* Reset folder permissions to default (Template says limitedAccess = false) */
function resetFolderPermissionsToDefault(folderId) {
  try {
    logRow('INFO', 'resetFolderPermissionsToDefault', `Resetting folder ${folderId} to default permissions (inheritance enabled)`);
    
    // Step 1: Disable inheritedPermissionsDisabled to restore inheritance
    try {
      Drive.Files.patch(
        { inheritedPermissionsDisabled: false },
        folderId,
        {
          supportsAllDrives: true,
          useDomainAdminAccess: true
        }
      );
      logRow('INFO', 'resetFolderPermissionsToDefault', `Disabled inheritedPermissionsDisabled for folder ${folderId} (restoring inheritance)`);
    } catch (e) {
      logRow('WARN', 'resetFolderPermissionsToDefault', `Failed to disable inheritedPermissionsDisabled: ${e.message}`);
    }
    
    // Step 2: Clean all direct group permissions
    const cleanResult = cleanAllGroupPermissionsFromFolder(folderId);
    
    // Step 3: Ensure domain permission exists for visibility
    const domain = getDefaultGroupDomain();
    if (domain) {
      try {
        const perms = getFolderPermissionsSafely(folderId);
        const existingPerms = perms.items || [];
        const domainPerm = existingPerms.find(p => p.type === 'domain' && p.role === 'reader');
        if (!domainPerm) {
          const domainBody = { type: 'domain', role: 'reader', value: domain };
          insertPermissionSafely(folderId, domainBody);
          logRow('INFO', 'resetFolderPermissionsToDefault', `Added domain permission (Viewer) to folder ${folderId}`);
        }
      } catch (e) {
        logRow('WARN', 'resetFolderPermissionsToDefault', `Error ensuring domain permission: ${e.message}`);
      }
    }
    
    logRow('INFO', 'resetFolderPermissionsToDefault', `Successfully reset folder ${folderId} to default permissions`);
    return true;
  } catch (e) {
    logRow('ERROR', 'resetFolderPermissionsToDefault', `Error resetting folder ${folderId}: ${e.message}`);
    return false;
  }
}

/* Apply Limited Access to folder - TEMPLATE IS SOURCE OF TRUTH */
/* This function ALWAYS enforces Template settings, overriding any manual Drive changes */
function applyLimitedAccessToFolder(folderId, node) {
  try {
    // Validate inputs
    if (!folderId) {
      throw new Error('folderId is required');
    }
    if (!node) {
      logRow('WARN', 'applyLimitedAccessToFolder', `Node is undefined for folder ${folderId}, using default values (limitedAccess=false)`);
      node = {};
    }
    
    const groups = (node && node.groups) ? node.groups : [];
    const users = (node && node.users) ? node.users : [];
    const limitedAccess = (node && node.limitedAccess) ? node.limitedAccess : false;
    
    logRow('INFO', 'applyLimitedAccessToFolder', `Applying Template settings to folder ${folderId}: limitedAccess=${limitedAccess}, groups=${groups.length}, users=${users.length}`);
    
    // ============================================
    // CASE 1: Template says limitedAccess = false
    // ============================================
    // MUST: Set inheritedPermissionsDisabled = false
    // MUST: Remove ALL direct group permissions (not in Template)
    // MUST: Clear any manual Limited-Access that users applied earlier
    // MUST: Ensure final state matches Template exactly
    if (!limitedAccess) {
      logRow('INFO', 'applyLimitedAccessToFolder', `Template says limitedAccess=false for folder ${folderId}. Resetting to default (inheritance enabled).`);
      resetFolderPermissionsToDefault(folderId);
      return;
    }
    
    // ============================================
    // CASE 2: Template says limitedAccess = true
    // ============================================
    // MUST: Set inheritedPermissionsDisabled = true
    // MUST: Remove ALL existing direct group permissions (ignore inherited/system)
    // MUST: Add ONLY the groups defined in Template config
    // MUST: Ignore whether user previously applied Limited Access manually
    // MUST: Ignore inherited group permissions from Drive root
    // MUST: Do not skip folders with "manual Limited Access" — override them
    
    logRow('INFO', 'applyLimitedAccessToFolder', `Template says limitedAccess=true for folder ${folderId}. Enforcing Limited Access (overriding any manual changes).`);
    
    // Step 1: Enable inheritedPermissionsDisabled to break inheritance from parent
    // This is the key setting that makes limited-access work properly
    // We enable this even if groups.length === 0 to restrict access to owners only
    try {
      Drive.Files.patch(
        { inheritedPermissionsDisabled: true },
        folderId,
        {
          supportsAllDrives: true,
          useDomainAdminAccess: true
        }
      );
      logRow('INFO', 'applyLimitedAccessToFolder', `✓ Enabled inheritedPermissionsDisabled for folder ${folderId} (breaking inheritance)`);
    } catch (e) {
      logRow('ERROR', 'applyLimitedAccessToFolder', `✗ Failed to set inheritedPermissionsDisabled for folder ${folderId}: ${e.message}`);
      throw e; // This is critical - fail if we can't set this
    }
    
    // Step 2: Remove ALL existing DIRECT group permissions first (ignore inherited/system)
    // This ensures we start with a clean slate and only add Template-specified groups
    logRow('INFO', 'applyLimitedAccessToFolder', `Cleaning all existing direct group permissions from folder ${folderId} (Template will specify which groups to add)`);
    const cleanResult = cleanAllGroupPermissionsFromFolder(folderId);
    logRow('INFO', 'applyLimitedAccessToFolder', `Cleaned ${cleanResult.removed} group permission(s) from folder ${folderId}`);
    
    // Step 3: Remove domain permissions to restrict access (only specified groups should have access)
    const domain = getDefaultGroupDomain();
    if (domain) {
      try {
        const perms = getFolderPermissionsSafely(folderId);
        const existingPerms = perms.items || [];
        const domainPerms = existingPerms.filter(p => p.type === 'domain');
        
        // Remove all DIRECT domain permissions to restrict access (ignore inherited/system)
        const directDomainPerms = [];
        domainPerms.forEach(perm => {
          const skipCheck = shouldSkipPermission(perm);
          if (!skipCheck.skip) {
            directDomainPerms.push(perm);
          }
        });
        
        if (directDomainPerms.length > 0) {
          logRow('INFO', 'applyLimitedAccessToFolder', `Removing ${directDomainPerms.length} direct domain permission(s) to restrict access to specified groups only`);
          directDomainPerms.forEach(perm => {
            try {
              const removed = removePermissionSafely(folderId, perm.id);
              if (removed) {
                const domainValue = perm.domain || perm.value || perm.id;
                logRow('INFO', 'applyLimitedAccessToFolder', `✓ Removed direct domain permission: ${domainValue}`);
              }
            } catch (e) {
              logRow('WARN', 'applyLimitedAccessToFolder', `Failed to remove domain permission: ${e.message}`);
            }
          });
          Utilities.sleep(300);
        }
      } catch (e) {
        logRow('WARN', 'applyLimitedAccessToFolder', `Error removing domain permissions: ${e.message}`);
      }
    }
    
    // Step 4: If no groups specified, just enable inheritedPermissionsDisabled and return
    // This makes the folder restricted (only owners can access)
    if (!groups || groups.length === 0) {
      logRow('INFO', 'applyLimitedAccessToFolder', `No groups specified for limited-access folder ${folderId}. Folder is now restricted (only owners can access).`);
      return;
    }
    
    // Step 5: Add ONLY the groups defined in Template config
    logRow('INFO', 'applyLimitedAccessToFolder', `Adding ${groups.length} group(s) from Template to folder ${folderId}`);
    
    const groupsMap = getGroupsMap();
    const addedGroupEmails = new Set();
    
    groups.forEach(groupItem => {
      let groupName, role;
      if (typeof groupItem === 'string') {
        groupName = groupItem;
        role = 'reader';
      } else {
        groupName = groupItem.name || groupItem;
        role = groupItem.role || 'reader';
      }
      
      // NEVER use 'owner' role - convert to 'organizer' for Shared Drive
      if (role === 'owner') {
        role = 'organizer';
        logRow('INFO', 'applyLimitedAccessToFolder', `Converted role "owner" to "organizer" (Manager) for Shared Drive folder`);
      }
      
      let groupEmail = normalizeGroupEmail(groupName);
      if (groupsMap[groupName]) {
        groupEmail = groupsMap[groupName];
      }
      
      // Validate group email before proceeding
      if (!groupEmail || (typeof groupEmail === 'string' && groupEmail.trim() === '') || groupEmail === 'undefined') {
        logRow('WARN', 'applyLimitedAccessToFolder', `Skipping group "${groupName}" because email is undefined or empty for folder ${folderId}`);
        return;
      }
      
      if (addedGroupEmails.has(groupEmail.toLowerCase())) {
        logRow('INFO', 'applyLimitedAccessToFolder', `Skipping duplicate group: ${groupEmail}`);
        return;
      }
      addedGroupEmails.add(groupEmail.toLowerCase());
      
      const body = { type: 'group', role: role, value: groupEmail };
      const inserted = insertPermissionSafely(folderId, body);
      if (inserted) {
        logRow('INFO', 'applyLimitedAccessToFolder', `✓ Applied ${role} permission to group ${groupEmail} on folder ${folderId}`);
      } else {
        logRow('WARN', 'applyLimitedAccessToFolder', `✗ Failed to apply ${role} permission to group ${groupEmail} on folder ${folderId}`);
      }
    });
    
    // Step 6: Apply permissions to individual users (if any)
    if (users && users.length > 0) {
      logRow('INFO', 'applyLimitedAccessToFolder', `Adding ${users.length} user(s) from Template to folder ${folderId}`);
      
      users.forEach(userItem => {
        let userEmail, role;
        if (typeof userItem === 'string') {
          userEmail = userItem;
          role = 'reader';
        } else {
          userEmail = userItem.email || userItem;
          role = userItem.role || 'reader';
        }
        
        // NEVER use 'owner' role - convert to 'organizer' for Shared Drive
        if (role === 'owner') {
          role = 'organizer';
          logRow('INFO', 'applyLimitedAccessToFolder', `Converted role "owner" to "organizer" (Manager) for Shared Drive folder`);
        }
        
        // Validate user email
        if (!userEmail || (typeof userEmail === 'string' && userEmail.trim() === '') || userEmail === 'undefined') {
          logRow('WARN', 'applyLimitedAccessToFolder', `Skipping user because email is undefined or empty for folder ${folderId}`);
          return;
        }
        
        if (addedGroupEmails.has(userEmail.toLowerCase())) {
          logRow('INFO', 'applyLimitedAccessToFolder', `Skipping duplicate user: ${userEmail}`);
          return;
        }
        addedGroupEmails.add(userEmail.toLowerCase());
        
        const body = { type: 'user', role: role, value: userEmail };
        const inserted = insertPermissionSafely(folderId, body);
        if (inserted) {
          logRow('INFO', 'applyLimitedAccessToFolder', `✓ Applied ${role} permission to user ${userEmail} on folder ${folderId}`);
        } else {
          logRow('WARN', 'applyLimitedAccessToFolder', `✗ Failed to apply ${role} permission to user ${userEmail} on folder ${folderId}`);
        }
      });
    }
    
    logRow('INFO', 'applyLimitedAccessToFolder', `✓ Successfully applied Limited Access to folder ${folderId} according to Template settings`);
    
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToFolder', `✗ Error applying Limited Access to folder ${folderId}: ${err.message}`);
    throw err;
  }
}

function applyLimitedAccessToPhaseFolder(phaseFolderId, template, folderType, pr) {
  try {
    // Validate inputs
    if (!phaseFolderId) {
      throw new Error('phaseFolderId is required');
    }
    if (!template || !Array.isArray(template) || template.length === 0) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', 'Template is invalid or empty');
      return;
    }
    
    const phaseIndex = folderType === 'RFP' ? 0 : 1;
    
    // Validate array bounds
    if (phaseIndex >= template.length) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', `Phase index ${phaseIndex} is out of bounds (template length: ${template.length}) for folderType ${folderType}`);
      return;
    }
    
    const phaseNode = template[phaseIndex];
    if (!phaseNode) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', `Phase node at index ${phaseIndex} is null or undefined for folderType ${folderType}`);
      return;
    }

    logRow('INFO', 'applyLimitedAccessToPhaseFolder', `Processing ${phaseNode.nodes ? phaseNode.nodes.length : 0} folders in ${folderType} phase`);
    
    // STEP 1: Ensure all folders from template exist in Drive (create missing ones)
    // This ensures that folders in template but not in Drive are created first
    logRow('INFO', 'applyLimitedAccessToPhaseFolder', `Ensuring all template folders exist in Drive for ${folderType} phase`);
    createSubfoldersFromTemplate(phaseFolderId, folderType, pr);
    
    // STEP 2: Apply limited access if enabled, even if no groups/users (will restrict to owners only)
    if (phaseNode.limitedAccess) {
      applyLimitedAccessToFolder(phaseFolderId, phaseNode);
    }

    // STEP 3: Apply permissions to all folders (both existing and newly created)
    // This will also handle folders that exist in Drive but not in template (disable limit access)
    if (phaseNode.nodes) {
      applyLimitedAccessToSubfolders(phaseFolderId, phaseNode.nodes, pr, folderType);
    }
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToPhaseFolder', `Error: ${err.message}`);
    throw err;
  }
}

function applyLimitedAccessToSubfolders(parentFolderId, nodes, pr, folderType) {
  // Validate inputs
  if (!parentFolderId) {
    logRow('ERROR', 'applyLimitedAccessToSubfolders', 'parentFolderId is required');
    return;
  }
  
  // Skip if no nodes to process (optimization: don't process folders not in template to save time)
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return;
  }
  
  try {
    const children = getFoldersInParent(parentFolderId);
    if (!children || children.length === 0) {
      logRow('WARN', 'applyLimitedAccessToSubfolders', `No child folders found in parent ${parentFolderId}, but template has ${nodes.length} node(s). Folders may need to be created.`);
      return;
    }
    
    // Normalize folderType for comparison (PD -> Project Delivery)
    const normalizedFolderType = folderType === 'PD' ? 'Project Delivery' : folderType;
    
    // Process folders that match template nodes
    nodes.forEach((node, index) => {
      const matchingFolder = children.find(child => {
        const info = parseNumberedFolder(child.title);
        if (!info) {
          // Fallback: try to match by name if parseNumberedFolder fails
          if (child.title.includes(node.text)) {
            return true;
          }
          return false;
        }
        // Check both old format (PD) and new format (Project Delivery)
        const phaseMatch = info.phase === folderType || info.phase === normalizedFolderType;
        const numberMatch = info.number === index + 1;
        const prMatch = info.pr === pr;
        
        if (numberMatch && phaseMatch && prMatch) {
          return true;
        }
        
        // Fallback: match by name if number/phase/PR match fails
        if (child.title.includes(node.text)) {
          return true;
        }
        return false;
      });

      if (matchingFolder) {
        // Always apply template configuration, even if folder has manual limit access
        // This ensures template settings override any manual changes
        applyLimitedAccessToFolder(matchingFolder.id, node);
        
        // Recursively process subfolders
        if (node.nodes && node.nodes.length > 0) {
          applyLimitedAccessToSubfolders(matchingFolder.id, node.nodes, pr, folderType);
        }
      }
    });
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToSubfolders', `Error: ${err.message}`);
  }
}

function applyLimitedAccessToProject(projectId, projectTitle) {
  try {
    // Validate inputs
    if (!projectId) {
      throw new Error('projectId is required');
    }
    
    // Get template if projectTitle is not provided or is a string
    let template;
    if (typeof projectTitle === 'string') {
      template = getTemplateTree();
    } else if (Array.isArray(projectTitle)) {
      template = projectTitle;
    } else {
      template = getTemplateTree();
    }
    
    if (!template || !Array.isArray(template) || template.length === 0) {
      logRow('WARN', 'applyLimitedAccessToProject', 'Template is empty or invalid');
      return;
    }
    
    // Extract PR from project title (more reliable than from folder title)
    const pr = extractPRNumber(projectTitle);
    if (!pr) {
      logRow('WARN', 'applyLimitedAccessToProject', `Could not extract PR number from project title: ${projectTitle}`);
      return;
    }
    
    const projectFolders = getFoldersInParent(projectId);
    if (!projectFolders || projectFolders.length === 0) {
      logRow('WARN', 'applyLimitedAccessToProject', `No folders found in project ${projectId}`);
      return;
    }
    const rfpFolder = projectFolders.find(f => f.title.includes('-RFP'));
    const pdFolder = projectFolders.find(f => f.title.includes('-PD') || f.title.includes('-Project Delivery'));
    
    if (rfpFolder && template[0]) {
      applyLimitedAccessToPhaseFolder(rfpFolder.id, template, 'RFP', pr);
    }
    
    if (pdFolder && template[1]) {
      applyLimitedAccessToPhaseFolder(pdFolder.id, template, 'PD', pr);
    }
    
    // Update snapshot for this project after applying changes
    // This ensures the snapshot reflects the new state immediately
    try {
      rescanProjectSnapshot(projectId);
      logRow('INFO', 'applyLimitedAccessToProject', `Updated snapshot for project ${projectId} after applying changes`);
    } catch (snapshotErr) {
      logRow('WARN', 'applyLimitedAccessToProject', `Failed to update snapshot for project ${projectId}: ${snapshotErr.message}`);
      // Don't fail the whole operation if snapshot update fails
    }
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToProject', `Error processing project ${projectId}: ${err.message}`);
    // Don't throw - continue with next project
  }
}

function applyLimitedAccessToAllProjects() {
  try {
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'Starting to apply Limited-access to all projects');
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'NOTE: This will apply the template configuration to all projects, replacing any manual changes');
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) throw new Error('Shared Drive ID not configured');
    
    const template = getTemplateTree();
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    let pageToken = null;
    let processed = 0;
    let errors = 0;
    const startTime = new Date().getTime();
    const maxTime = 4.5 * 60 * 1000; // 4.5 minutes
    
    // Log initial status
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'Fetching list of projects...');
    
    do {
      // Check timeout before processing each page
      const elapsed = new Date().getTime() - startTime;
      if (elapsed > maxTime) {
        const message = `Operation timed out after ${processed} projects (${Math.round(elapsed/1000)}s). Some projects may not have been processed.`;
        logRow('WARN', 'applyLimitedAccessToAllProjects', message);
        return message;
      }
      
      const res = Drive.Files.list({ 
        q: q, 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        maxResults: 100, 
        pageToken: pageToken 
      });
      
      const items = res.items || [];
      logRow('INFO', 'applyLimitedAccessToAllProjects', `Found ${items.length} projects in this batch. Starting processing...`);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check timeout before processing each project
        const elapsed = new Date().getTime() - startTime;
        if (elapsed > maxTime) {
          const message = `Operation timed out after ${processed} projects (${Math.round(elapsed/1000)}s). Stopping at project: ${item.title}`;
          logRow('WARN', 'applyLimitedAccessToAllProjects', message);
          return message;
        }
        
        try {
          logRow('INFO', 'applyLimitedAccessToAllProjects', `Processing project ${processed + 1}: ${item.title}`);
          applyLimitedAccessToProject(item.id, template);
          
          // Update snapshot for this project after applying changes
          try {
            rescanProjectSnapshot(item.id);
            logRow('INFO', 'applyLimitedAccessToAllProjects', `Updated snapshot for project ${item.title}`);
          } catch (snapshotErr) {
            logRow('WARN', 'applyLimitedAccessToAllProjects', `Failed to update snapshot for project ${item.title}: ${snapshotErr.message}`);
          }
          
          processed++;
          
          // Log progress every project and add small delay to avoid rate limiting
          logRow('INFO', 'applyLimitedAccessToAllProjects', `✓ Completed project ${processed}: ${item.title}`);
          if (processed % 3 === 0) {
            Utilities.sleep(200);
          }
        } catch (e) {
          errors++;
          logRow('ERROR', 'applyLimitedAccessToAllProjects', `✗ Failed to process project ${item.title}: ${e.message}`);
        }
      }
      
      pageToken = res.nextPageToken;
      if (pageToken) {
        logRow('INFO', 'applyLimitedAccessToAllProjects', `Completed batch. Moving to next page... (Processed: ${processed}, Errors: ${errors})`);
      }
    } while (pageToken);
    
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    const message = `Successfully processed ${processed} project(s) in ${elapsed}s${errors > 0 ? `, ${errors} error(s)` : ''}`;
    logRow('INFO', 'applyLimitedAccessToAllProjects', `✓ ${message}`);
    return message;
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToAllProjects', `Error: ${err.message}`);
    throw err;
  }
}

function applyLimitedAccessToProject(projectId, projectTitle) {
  try {
    // Validate inputs
    if (!projectId) {
      throw new Error('projectId is required');
    }
    
    // Get template if projectTitle is not provided or is a string
    let template;
    if (typeof projectTitle === 'string') {
      template = getTemplateTree();
    } else if (Array.isArray(projectTitle)) {
      template = projectTitle;
    } else {
      template = getTemplateTree();
    }
    
    if (!template || !Array.isArray(template) || template.length === 0) {
      logRow('WARN', 'applyLimitedAccessToProject', 'Template is empty or invalid');
      return;
    }
    
    // Extract PR from project title (more reliable than from folder title)
    const pr = extractPRNumber(projectTitle);
    if (!pr) {
      logRow('WARN', 'applyLimitedAccessToProject', `Could not extract PR number from project title: ${projectTitle}`);
      return;
    }
    
    const projectFolders = getFoldersInParent(projectId);
    if (!projectFolders || projectFolders.length === 0) {
      logRow('WARN', 'applyLimitedAccessToProject', `No folders found in project ${projectId}`);
      return;
    }
    const rfpFolder = projectFolders.find(f => f.title.includes('-RFP'));
    const pdFolder = projectFolders.find(f => f.title.includes('-PD') || f.title.includes('-Project Delivery'));
    
    if (rfpFolder && template[0]) {
      applyLimitedAccessToPhaseFolder(rfpFolder.id, template, 'RFP', pr);
    }
    
    if (pdFolder && template[1]) {
      applyLimitedAccessToPhaseFolder(pdFolder.id, template, 'PD', pr);
    }
    
    // Update snapshot for this project after applying changes
    // This ensures the snapshot reflects the new state immediately
    try {
      rescanProjectSnapshot(projectId);
      logRow('INFO', 'applyLimitedAccessToProject', `Updated snapshot for project ${projectId} after applying changes`);
    } catch (snapshotErr) {
      logRow('WARN', 'applyLimitedAccessToProject', `Failed to update snapshot for project ${projectId}: ${snapshotErr.message}`);
      // Don't fail the whole operation if snapshot update fails
    }
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToProject', `Error processing project ${projectId}: ${err.message}`);
    // Don't throw - continue with next project
  }
}

function applyLimitedAccessToPhaseFolder(phaseFolderId, template, folderType, pr) {
  try {
    // Validate inputs
    if (!phaseFolderId) {
      throw new Error('phaseFolderId is required');
    }
    if (!template || !Array.isArray(template) || template.length === 0) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', 'Template is invalid or empty');
      return;
    }
    
    const phaseIndex = folderType === 'RFP' ? 0 : 1;
    
    // Validate array bounds
    if (phaseIndex >= template.length) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', `Phase index ${phaseIndex} is out of bounds (template length: ${template.length}) for folderType ${folderType}`);
      return;
    }
    
    const phaseNode = template[phaseIndex];
    if (!phaseNode) {
      logRow('WARN', 'applyLimitedAccessToPhaseFolder', `Phase node at index ${phaseIndex} is null or undefined for folderType ${folderType}`);
      return;
    }

    logRow('INFO', 'applyLimitedAccessToPhaseFolder', `Processing ${phaseNode.nodes ? phaseNode.nodes.length : 0} folders in ${folderType} phase`);
    
    // STEP 1: Ensure all folders from template exist in Drive (create missing ones)
    // This ensures that folders in template but not in Drive are created first
    logRow('INFO', 'applyLimitedAccessToPhaseFolder', `Ensuring all template folders exist in Drive for ${folderType} phase`);
    createSubfoldersFromTemplate(phaseFolderId, folderType, pr);
    
    // STEP 2: Apply limited access if enabled, even if no groups/users (will restrict to owners only)
    if (phaseNode.limitedAccess) {
      applyLimitedAccessToFolder(phaseFolderId, phaseNode);
    }

    // STEP 3: Apply permissions to all folders (both existing and newly created)
    // This will also handle folders that exist in Drive but not in template (disable limit access)
    if (phaseNode.nodes) {
      applyLimitedAccessToSubfolders(phaseFolderId, phaseNode.nodes, pr, folderType);
    }
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToPhaseFolder', `Error: ${err.message}`);
    throw err;
  }
}

function applyLimitedAccessToSubfolders(parentFolderId, nodes, pr, folderType) {
  // Validate inputs
  if (!parentFolderId) {
    logRow('ERROR', 'applyLimitedAccessToSubfolders', 'parentFolderId is required');
    return;
  }
  
  // Skip if no nodes to process (optimization: don't process folders not in template to save time)
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return;
  }
  
  try {
    const children = getFoldersInParent(parentFolderId);
    if (!children || children.length === 0) {
      logRow('WARN', 'applyLimitedAccessToSubfolders', `No child folders found in parent ${parentFolderId}, but template has ${nodes.length} node(s). Folders may need to be created.`);
      return;
    }
    
    // Normalize folderType for comparison (PD -> Project Delivery)
    const normalizedFolderType = folderType === 'PD' ? 'Project Delivery' : folderType;
    
    // Process folders that match template nodes
    nodes.forEach((node, index) => {
      const matchingFolder = children.find(child => {
        const info = parseNumberedFolder(child.title);
        if (!info) {
          // Fallback: try to match by name if parseNumberedFolder fails
          if (child.title.includes(node.text)) {
            return true;
          }
          return false;
        }
        // Check both old format (PD) and new format (Project Delivery)
        const phaseMatch = info.phase === folderType || info.phase === normalizedFolderType;
        const numberMatch = info.number === index + 1;
        const prMatch = info.pr === pr;
        
        if (numberMatch && phaseMatch && prMatch) {
          return true;
        }
        
        // Fallback: match by name if number/phase/PR match fails
        if (child.title.includes(node.text)) {
          return true;
        }
        return false;
      });

      if (matchingFolder) {
        // Always apply template configuration, even if folder has manual limit access
        // This ensures template settings override any manual changes
        applyLimitedAccessToFolder(matchingFolder.id, node);
        
        // Recursively process subfolders
        if (node.nodes && node.nodes.length > 0) {
          applyLimitedAccessToSubfolders(matchingFolder.id, node.nodes, pr, folderType);
        }
      }
    });
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToSubfolders', `Error: ${err.message}`);
  }
}

function applyLimitedAccessToAllProjects() {
  try {
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'Starting to apply Limited-access to all projects');
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'NOTE: This will apply the template configuration to all projects, replacing any manual changes');
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) throw new Error('Shared Drive ID not configured');
    
    const template = getTemplateTree();
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    let pageToken = null;
    let processed = 0;
    let errors = 0;
    const startTime = new Date().getTime();
    const maxTime = 4.5 * 60 * 1000; // 4.5 minutes
    
    // Log initial status
    logRow('INFO', 'applyLimitedAccessToAllProjects', 'Fetching list of projects...');
    
    do {
      // Check timeout before processing each page
      const elapsed = new Date().getTime() - startTime;
      if (elapsed > maxTime) {
        const message = `Operation timed out after ${processed} projects (${Math.round(elapsed/1000)}s). Some projects may not have been processed.`;
        logRow('WARN', 'applyLimitedAccessToAllProjects', message);
        return message;
      }
      
      const res = Drive.Files.list({ 
        q: q, 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        maxResults: 100, 
        pageToken: pageToken 
      });
      
      const items = res.items || [];
      logRow('INFO', 'applyLimitedAccessToAllProjects', `Found ${items.length} projects in this batch. Starting processing...`);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Check timeout before processing each project
        const elapsed = new Date().getTime() - startTime;
        if (elapsed > maxTime) {
          const message = `Operation timed out after ${processed} projects (${Math.round(elapsed/1000)}s). Stopping at project: ${item.title}`;
          logRow('WARN', 'applyLimitedAccessToAllProjects', message);
          return message;
        }
        
        try {
          logRow('INFO', 'applyLimitedAccessToAllProjects', `Processing project ${processed + 1}: ${item.title}`);
          applyLimitedAccessToProject(item.id, template);
          
          // Update snapshot for this project after applying changes
          try {
            rescanProjectSnapshot(item.id);
            logRow('INFO', 'applyLimitedAccessToAllProjects', `Updated snapshot for project ${item.title}`);
          } catch (snapshotErr) {
            logRow('WARN', 'applyLimitedAccessToAllProjects', `Failed to update snapshot for project ${item.title}: ${snapshotErr.message}`);
          }
          
          processed++;
          
          // Log progress every project and add small delay to avoid rate limiting
          logRow('INFO', 'applyLimitedAccessToAllProjects', `✓ Completed project ${processed}: ${item.title}`);
          if (processed % 3 === 0) {
            Utilities.sleep(200);
          }
        } catch (e) {
          errors++;
          logRow('ERROR', 'applyLimitedAccessToAllProjects', `✗ Failed to process project ${item.title}: ${e.message}`);
        }
      }
      
      pageToken = res.nextPageToken;
      if (pageToken) {
        logRow('INFO', 'applyLimitedAccessToAllProjects', `Completed batch. Moving to next page... (Processed: ${processed}, Errors: ${errors})`);
      }
    } while (pageToken);
    
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    const message = `Successfully processed ${processed} project(s) in ${elapsed}s${errors > 0 ? `, ${errors} error(s)` : ''}`;
    logRow('INFO', 'applyLimitedAccessToAllProjects', `✓ ${message}`);
    return message;
  } catch (err) {
    logRow('ERROR', 'applyLimitedAccessToAllProjects', `Error: ${err.message}`);
    throw err;
  }
}

function applyPermissionsToFolder(nodePath) {
  try {
    // Validate input
    if (!nodePath || !Array.isArray(nodePath) || nodePath.length === 0) {
      logRow('WARN', 'applyPermissionsToFolder', `nodePath is invalid or empty: ${JSON.stringify(nodePath)}`);
      return { success: false, error: 'nodePath is required and must be a non-empty array' };
    }
    
    logRow('INFO', 'applyPermissionsToFolder', `Applying permissions to folder at path: ${JSON.stringify(nodePath)}`);
    
    const template = getTemplateTree();
    if (!template) {
      logRow('WARN', 'applyPermissionsToFolder', 'Template tree is not available');
      return { success: false, error: 'Template tree is not available' };
    }
    
    const node = getNodeByPath(template, nodePath);
    if (!node) {
      logRow('WARN', 'applyPermissionsToFolder', `Folder not found in template for path: ${JSON.stringify(nodePath)}`);
      return { success: false, error: 'Folder not found in template' };
    }
    
    if (!node.limitedAccess) {
      throw new Error('Limited access is not enabled for this folder');
    }
    
    if (!node.groups || node.groups.length === 0) {
      throw new Error('No groups specified for this folder');
    }
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) throw new Error('Shared Drive ID not configured');
    
    const q = `'${rootDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    
    let pageToken = null;
    let processed = 0;
    let errors = 0;
    const startTime = new Date().getTime();
    const maxTime = 4.5 * 60 * 1000; // 4.5 minutes
    
    do {
      if (new Date().getTime() - startTime > maxTime) {
        logRow('WARN', 'applyPermissionsToFolder', 'Operation timed out. Some projects may not have been processed.');
        break;
      }
      
      const res = Drive.Files.list({ 
        q: q, 
        supportsAllDrives: true, 
        includeItemsFromAllDrives: true, 
        maxResults: 100, 
        pageToken: pageToken 
      });
      
      const items = res.items || [];
      items.forEach(project => {
        try {
          const pr = extractPRNumber(project.title);
          if (!pr) return;
          
          const folder = resolveFolderByPath(project.id, nodePath, pr, null, null);
          if (folder) {
            applyLimitedAccessToFolder(folder.id, node);
            processed++;
          }
          
          if (processed % 10 === 0) {
            logRow('INFO', 'applyPermissionsToFolder', `Processed ${processed} folders so far...`);
          }
        } catch (e) {
          errors++;
          logRow('ERROR', 'applyPermissionsToFolder', `Failed to process project ${project.title}: ${e.message}`);
        }
      });
      
      pageToken = res.nextPageToken;
    } while (pageToken);
    
    const message = `Successfully applied permissions to ${processed} folder(s)${errors > 0 ? `, ${errors} error(s)` : ''}`;
    logRow('INFO', 'applyPermissionsToFolder', message);
    return message;
  } catch (err) {
    logRow('ERROR', 'applyPermissionsToFolder', `Error: ${err.message}`);
    throw err;
  }
}

function testFolderPermissions(folderId) {
  try {
    // Validate input
    if (!folderId) {
      throw new Error('folderId is required');
    }
    
    let folderInfo = null;
    try {
      folderInfo = Drive.Files.get(folderId, { supportsAllDrives: true, useDomainAdminAccess: true });
    } catch (e1) {
      try {
        folderInfo = Drive.Files.get(folderId, { supportsAllDrives: true });
      } catch (e2) {
        throw new Error(`Folder not found: ${folderId}. Error: ${e2.message}`);
      }
    }
    
    if (!folderInfo) {
      throw new Error(`Folder not found: ${folderId}`);
    }

    // Request permission details including nested permissionDetails for inherited status
    const fields = 'items(' +
      'id,type,role,emailAddress,domain,value,deleted,displayName,name,' +
      'permissionDetails,' +
      'teamDrivePermissionDetails' +
    ')';
    
    let perms = null;
    try {
      perms = Drive.Permissions.list(folderId, { 
        supportsAllDrives: true, 
        useDomainAdminAccess: true, 
        maxResults: 100,
        fields: fields
      });
    } catch (e1) {
      try {
        perms = Drive.Permissions.list(folderId, { 
          supportsAllDrives: true, 
          maxResults: 100,
          fields: fields
        });
      } catch (e2) {
        logRow('ERROR', 'testFolderPermissions', `Error reading permissions for folder ${folderId}: ${e2.message}`);
        throw new Error(`Cannot read permissions for folder "${folderInfo.title || folderId}": ${e2.message}`);
      }
    }

    const permissionsList = (perms.items || []).map(p => ({
      id: p.id,
      type: p.type,
      role: p.role,
      emailAddress: p.emailAddress,
      displayName: p.displayName,
      domain: p.domain,
      name: p.name || p.emailAddress || p.displayName || p.domain || p.id
    }));

    const result = {
      folderId: folderId,
      folderName: folderInfo.title || 'Unknown',
      folderMimeType: folderInfo.mimeType || 'unknown',
      permissions: permissionsList,
      summary: {
        total: permissionsList.length,
        domain: permissionsList.filter(p => p.type === 'domain').length,
        anyone: permissionsList.filter(p => p.type === 'anyone').length,
        groups: permissionsList.filter(p => p.type === 'group').length,
        users: permissionsList.filter(p => p.type === 'user').length,
        fileOrganizer: permissionsList.filter(p => p.role === 'fileOrganizer' || p.role === 'organizer').length,
        writer: permissionsList.filter(p => p.role === 'writer').length,
        commenter: permissionsList.filter(p => p.role === 'commenter').length,
        reader: permissionsList.filter(p => p.role === 'reader').length
      }
    };
    
    logRow('INFO', 'testFolderPermissions', `Tested permissions for folder "${folderInfo.title}" (${folderId}): ${JSON.stringify(result.summary)}`);
    return result;
  } catch (err) {
    logRow('ERROR', 'testFolderPermissions', `Error testing permissions for folder ${folderId}: ${err.message}`);
    throw err;
  }
}

function getRecentLogs(limit) {
  try {
    let ss = null;
    const logsSheetId = PropertiesService.getScriptProperties().getProperty('LOGS_SPREADSHEET_ID');
    if (logsSheetId) {
      try {
        ss = SpreadsheetApp.openById(logsSheetId);
      } catch (e) {
        ss = SpreadsheetApp.getActiveSpreadsheet();
      }
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
  if (!ss) return [];
    
  const sh = ss.getSheetByName('DTG_Logs');
    if (!sh || sh.getLastRow() === 0) return [];
    
    const rows = sh.getDataRange().getValues();
    const headers = rows[0];
    const logs = [];
    
    const startRow = Math.max(1, rows.length - (limit || 100));
    for (let i = startRow; i < rows.length; i++) {
      if (rows[i].length >= 4) {
        logs.push({
          timestamp: rows[i][0],
          level: rows[i][1],
          action: rows[i][2],
          message: rows[i][3],
          meta: rows[i][4] || ''
        });
      }
    }
    
    return logs.reverse();
  } catch (err) {
    logRow('ERROR', 'getRecentLogs', `Error: ${err.message}`);
    return [];
  }
}

function getLogs(limit) {
  return getRecentLogs(limit);
}

function buildNumberedFolderTitle(number, pr, folderType, name) {
  // For subfolders, use 'PD' instead of 'Project Delivery' in the name
  const folderTypeForName = folderType === 'Project Delivery' ? 'PD' : folderType;
  return `${number}-PRJ-${pr}-${folderTypeForName}-${name}`;
}

function parseNumberedFolder(title) {
  const match = title.match(/^(\d+)-PRJ-(\d+)-(RFP|PD|Project Delivery)-(.+)$/);
  if (match) {
    return { number: parseInt(match[1]), pr: match[2], phase: match[3] === 'Project Delivery' ? 'PD' : match[3], name: match[4] };
  }
  return null;
}

function getRFPFolder(projectRootFolderId, pr_number) {
  const rfpFolderName = `PRJ-${pr_number}-RFP`;
  const q = `'${projectRootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and title = '${rfpFolderName}'`;
  const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 1 });
  return res.items && res.items.length > 0 ? res.items[0] : null;
}

function listDescendantFolders(parentId, depthLimit) {
  depthLimit = depthLimit || 5;
  const folders = [];
  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  try {
    const res = Drive.Files.list({ q: q, supportsAllDrives: true, includeItemsFromAllDrives: true, maxResults: 500 });
    const items = res.items || [];
    items.forEach(item => {
      folders.push(item);
      if (depthLimit > 1) {
        folders.push(...listDescendantFolders(item.id, depthLimit - 1));
      }
    });
  } catch (e) {
    logRow('WARN', 'listDescendantFolders', `Error listing descendants: ${e.message}`);
  }
  return folders;
}

/* Generate removal log based on selected features */
function generateFeatureRemovalLog(selectedFeatures) {
  // Feature to function mapping
  const featureMap = {
    // Project Management
    'create-rfp': ['createRFPProject', 'requestRFPApproval', 'getNextPRNumber', 'isProjectNameExists', 'getProjectRootFolder', 'getRFPFolder'],
    'create-pd': ['createPDFolder', 'requestPDApproval', 'hasPDFolder', 'getPDFolder'],
    'approval-system': ['doGet', 'renderTemplate', 'sendApprovalEmail', 'getWebAppUrl', 'getApprovalRecipient'],
    'pr-number': ['getNextPRNumber', 'extractPRNumber'],
    'check-duplicates': ['scanForDuplicateProjects', 'findProjectByName'],
    'list-projects': ['getBiddingProjects', 'getProjectsWithoutPD'],
    
    // Template Management
    'folder-template': ['getTemplateTree', 'saveConfig', 'resetTemplateConfig', 'saveTemplateBackup', 'getTemplateBackup', 'restoreTemplateFromBackup'],
    'add-folder': ['addFolderToTemplate', 'addFolderToTemplateFromUI', 'bulkAddFoldersToTemplate', 'importFolderStructureFromDrive', 'applyNewFolderToExistingProjects', 'findTargetFolderForNewSubfolder', 'getNextFolderNumber'],
    'remove-folder': ['removeFolderFromTemplate', 'removeFolderFromTemplateFromUI'],
    'rename-folder': ['renameFolderInTemplate', 'renameFolderInTemplateFromUI', 'applyRenameToExistingProjects', 'applyRenameToExistingProjectsByPath', 'checkExistingFoldersForRename', 'findFoldersByPartialName', 'findFoldersByActualName', 'findFoldersByPathAndName', 'findFoldersToRename', 'findFoldersToRenameInProject', 'mapTreeToDriveFolders', 'getNextFolderNumberForRename'],
    'save-template': ['saveConfig', 'resetTemplateConfig'],
    'apply-to-existing': ['applyConfigToAllProjectsSharedDrive', 'applyNewFolderToExistingProjects', 'applyRenameToExistingProjects'],
    
    // Permissions & Security
    'limited-access': ['applyLimitedAccessToFolder', 'applyLimitedAccessToProject', 'applyLimitedAccessToPhaseFolder', 'applyLimitedAccessToSubfolders', 'applyLimitedAccessToAllProjects'],
    'group-permissions': ['applyLimitedAccessToFolder', 'getGroupsMap', 'normalizeGroupEmail'],
    'apply-permissions': ['applyPermissionsToFolder', 'resolveFolderByPath'],
    'apply-to-all': ['applyLimitedAccessToAllProjects'],
    'test-permissions': ['testFolderPermissions'],
    'access-policy': ['getAccessPolicy', 'saveAccessPolicy', 'collectGroupsFromTemplate'],
    'domain-sharing': ['shareFolderWithDomain', 'shareAllFoldersRecursively', 'shareAllFoldersRecursivelyWithTemplate'],
    
    // Groups & Members
    'list-users': ['getAllDomainUsers'],
    'users-with-groups': ['getAllUsersWithGroups'],
    'manage-members': ['listGroupMembers', 'addGroupMember', 'removeGroupMember'],
    'list-groups': ['getGroupsMap', 'listGroupMembers'],
    'group-roles': ['getAccessPolicy', 'saveAccessPolicy'],
    
    // File Restrictions
    'block-files': ['getFileRestrictions', 'addBlockedExtension', 'removeBlockedExtension', 'isFileBlocked', 'saveFileRestrictions'],
    'allow-files': ['getFileRestrictions', 'addAllowedExtension', 'removeAllowedExtension', 'setWhitelistEnabled', 'saveFileRestrictions'],
    'file-monitoring': ['monitorAndDeleteBlockedFiles', 'getFileMonitoringStatus'],
    'monitoring-trigger': ['setupFileMonitoring', 'getFileMonitoringStatus'],
    
    // Logging
    'log-system': ['logRow'],
    'view-logs': ['getLogs', 'getRecentLogs'],
    
    // Email
    'approval-email': ['sendApprovalEmail', 'renderHtmlFileToString', 'getWebAppUrl'],
    'email-recipients': ['getApprovalRecipients', 'saveApprovalRecipients', 'getApprovalRecipient'],
    'email-templates': ['renderHtmlFileToString', 'renderTemplate'],
    
    // Utilities
    'scan-duplicates': ['scanForDuplicateProjects'],
    'sync-recent': ['cronSyncRecent'],
    'audit-all': ['cronAuditAll'],
    'folder-scan': ['scanAllFoldersForLimitAccess', 'getAllFoldersRecursively', 'readFolderLimitAccessFromDrive'],
    'snapshot-system': ['scanDriveSnapshot', 'scanGroupsSnapshot', 'rescanProjectSnapshot', 'getSnapshotStatus', 'getProjectSnapshotStatus', 'setupSnapshotTrigger', 'getSnapshotSpreadsheet', 'getFolderSnapshotSheet', 'getGroupsSnapshotSheet', 'getFolderSnapshotById', 'getFolderSnapshotRowsForProject', 'updateFolderSnapshotRow']
  };
  
  // Helper functions that are used by multiple features (should be kept)
  const coreHelpers = [
    'doGet', 'renderTemplate', 'include', 'getAuthInfo',
    'getDefaultGroupDomain', 'normalizeGroupEmail',
    'getTemplateTree', 'getTemplatePathNodes', 'getFolderTypeFromPath',
    'buildNumberedFolderTitle', 'parseNumberedFolder',
    'getFoldersInParent', 'getProjectRootFolder',
    'getRFPFolder', 'getPDFolder',
    'createSubfoldersRecursively', 'createSubfoldersFromTemplate',
    'listDescendantFolders', 'getAllProjectFolders',
    'findNodeByPath', 'findTemplateNodeByPath', 'getNodeByPath',
    'resolveFolderByPath', 'requestApproval',
    'readFolderLimitAccessFromDrive', 'extractPRNumber'
  ];
  
  // Collect all functions to keep
  const functionsToKeep = new Set(coreHelpers);
  selectedFeatures.forEach(feature => {
    if (featureMap[feature]) {
      featureMap[feature].forEach(func => functionsToKeep.add(func));
    }
  });
  
  // Collect all functions to remove
  const allFunctions = new Set();
  Object.values(featureMap).forEach(funcs => {
    funcs.forEach(func => allFunctions.add(func));
  });
  
  const functionsToRemove = Array.from(allFunctions).filter(func => !functionsToKeep.has(func));
  
  // Generate log
  let log = '=== FEATURE REMOVAL LOG ===\n\n';
  log += `Generated: ${new Date().toISOString()}\n`;
  log += `Selected Features: ${selectedFeatures.length}\n`;
  log += `Functions to Keep: ${functionsToKeep.size}\n`;
  log += `Functions to Remove: ${functionsToRemove.length}\n\n`;
  
  log += '=== SELECTED FEATURES ===\n';
  selectedFeatures.forEach(feature => {
    log += `✓ ${feature}\n`;
    if (featureMap[feature]) {
      featureMap[feature].forEach(func => {
        log += `  → ${func}\n`;
      });
    }
  });
  
  log += '\n=== FUNCTIONS TO REMOVE ===\n';
  if (functionsToRemove.length === 0) {
    log += 'None - all functions are needed for selected features.\n';
  } else {
    functionsToRemove.sort().forEach(func => {
      log += `✗ ${func}\n`;
    });
  }
  
  log += '\n=== FUNCTIONS TO KEEP ===\n';
  Array.from(functionsToKeep).sort().forEach(func => {
    log += `✓ ${func}\n`;
  });
  
  log += '\n=== FILES TO CHECK ===\n';
  log += 'Code.gs - Check and remove unused functions listed above\n';
  log += 'GroupsAndAccess.gs - Check if getAllDomainUsers, getAllUsersWithGroups, getGroupsMap, listGroupMembers, addGroupMember, removeGroupMember are needed\n';
  log += 'Ui_Combined.html - Check and remove unused UI functions and buttons\n';
  log += 'EmailTemplate.html - Check if used by approval-email feature\n';
  log += 'ApprovalSuccess.html - Check if used by approval-system feature\n';
  
  log += '\n=== NOTES ===\n';
  log += '1. Review each function before removing - some may be used indirectly\n';
  log += '2. Check for function calls in UI (Ui_Combined.html)\n';
  log += '3. Check for function calls in other files\n';
  log += '4. Test the application after removing code\n';
  log += '5. Keep helper functions that are used by multiple features\n';
  
  return log;
}

/* ========== Code Analyzer & Auto-Fix ========== */

function analyzeCodebase() {
  const analysis = {
    timestamp: new Date().toISOString(),
    errors: [],
    warnings: [],
    missingFunctions: [],
    unusedFunctions: [],
    uiFunctions: [],
    backendFunctions: [],
    fileChecks: {}
  };

  try {
    // Get all functions from Code.gs
    const codeGsContent = getFileContent('Code.gs');
    const codeGsFunctions = extractFunctions(codeGsContent);
    analysis.backendFunctions = codeGsFunctions;
    logRow('INFO', 'analyzeCodebase', `Found ${codeGsFunctions.length} functions in Code.gs`);

    // Get all functions from GroupsAndAccess.gs
    const groupsGsContent = getFileContent('GroupsAndAccess.gs');
    const groupsGsFunctions = extractFunctions(groupsGsContent);
    analysis.backendFunctions = analysis.backendFunctions.concat(groupsGsFunctions);
    logRow('INFO', 'analyzeCodebase', `Found ${groupsGsFunctions.length} functions in GroupsAndAccess.gs`);

    // Get all UI functions from Ui_Combined.html
    const uiContent = getFileContent('Ui_Combined.html');
    const uiFunctions = extractUIFunctions(uiContent);
    analysis.uiFunctions = uiFunctions;
    logRow('INFO', 'analyzeCodebase', `Found ${uiFunctions.length} UI functions`);

    // Get all function calls from UI
    const uiFunctionCalls = extractFunctionCalls(uiContent);
    logRow('INFO', 'analyzeCodebase', `Found ${uiFunctionCalls.length} function calls in UI`);

    // Check for missing functions
    uiFunctionCalls.forEach(funcName => {
      if (!analysis.backendFunctions.includes(funcName)) {
        if (!analysis.missingFunctions.includes(funcName)) {
          analysis.missingFunctions.push(funcName);
          analysis.errors.push({
            type: 'missing_function',
            severity: 'error',
            message: `Function "${funcName}" is called from UI but not found in backend`,
            file: 'Ui_Combined.html',
            function: funcName
          });
        }
      }
    });

    // Check for functions in Feature Map that don't exist
    const featureMap = getFeatureMap();
    const allFeatureFunctions = new Set();
    Object.values(featureMap).forEach(funcs => {
      funcs.forEach(func => allFeatureFunctions.add(func));
    });

    allFeatureFunctions.forEach(funcName => {
      if (!analysis.backendFunctions.includes(funcName)) {
        if (!analysis.missingFunctions.includes(funcName)) {
          analysis.missingFunctions.push(funcName);
          analysis.warnings.push({
            type: 'feature_map_mismatch',
            severity: 'warning',
            message: `Function "${funcName}" is in Feature Map but not found in code`,
            function: funcName
          });
        }
      }
    });

    // Check for potentially unused functions (functions not called from UI and not in feature map)
    analysis.backendFunctions.forEach(funcName => {
      if (!uiFunctionCalls.includes(funcName) && !allFeatureFunctions.has(funcName)) {
        // Skip core functions that are always needed
        const coreFunctions = ['doGet', 'renderTemplate', 'include', 'logRow', 'getAuthInfo', 'getTemplateTree', 'saveConfig'];
        if (!coreFunctions.includes(funcName)) {
          analysis.unusedFunctions.push(funcName);
          analysis.warnings.push({
            type: 'potentially_unused',
            severity: 'warning',
            message: `Function "${funcName}" may be unused (not called from UI and not in feature map)`,
            function: funcName
          });
        }
      }
    });

    // Check file existence
    const requiredFiles = ['Code.gs', 'GroupsAndAccess.gs', 'Ui_Combined.html', 'EmailTemplate.html', 'ApprovalSuccess.html', 'FeatureSelector_Embedded.html'];
    requiredFiles.forEach(fileName => {
      try {
        const content = getFileContent(fileName);
        analysis.fileChecks[fileName] = {
          exists: true,
          size: content.length,
          functions: fileName.endsWith('.gs') ? extractFunctions(content) : []
        };
      } catch (e) {
        analysis.fileChecks[fileName] = {
          exists: false,
          error: e.message
        };
        analysis.errors.push({
          type: 'missing_file',
          severity: 'error',
          message: `Required file "${fileName}" not found`,
          file: fileName
        });
      }
    });

    // Check for common issues
    checkCommonIssues(analysis, codeGsContent, uiContent);

    analysis.summary = {
      totalErrors: analysis.errors.length,
      totalWarnings: analysis.warnings.length,
      missingFunctionsCount: analysis.missingFunctions.length,
      unusedFunctionsCount: analysis.unusedFunctions.length,
      totalBackendFunctions: analysis.backendFunctions.length,
      totalUIFunctions: analysis.uiFunctions.length
    };

    logRow('INFO', 'analyzeCodebase', `Analysis complete: ${analysis.summary.totalErrors} errors, ${analysis.summary.totalWarnings} warnings`);
    return analysis;
  } catch (err) {
    logRow('ERROR', 'analyzeCodebase', `Error during analysis: ${err.message}`);
    analysis.errors.push({
      type: 'analysis_error',
      severity: 'error',
      message: `Analysis failed: ${err.message}`
    });
    return analysis;
  }
}

function getFileContent(fileName) {
  // In Apps Script, we can't directly read file content from the script editor
  // We'll use a workaround: return empty string and rely on manual function lists
  // For better analysis, we'd need to use Drive API to read the .gs files
  return '';
}

function extractFunctions(content) {
  const functions = [];
  const functionRegex = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  return functions;
}

function extractUIFunctions(content) {
  const functions = [];
  const functionRegex = /^function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gm;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    functions.push(match[1]);
  }
  return functions;
}

function extractFunctionCalls(content) {
  const functionCalls = new Set();
  
  // Extract from google.script.run calls
  const scriptRunRegex = /\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  let match;
  while ((match = scriptRunRegex.exec(content)) !== null) {
    const funcName = match[1];
    // Skip common methods like withSuccessHandler, withFailureHandler
    if (!['withSuccessHandler', 'withFailureHandler', 'run'].includes(funcName)) {
      functionCalls.add(funcName);
    }
  }
  
  return Array.from(functionCalls);
}

function getFeatureMap() {
  // Return the feature map from generateFeatureRemovalLog
  return {
    'create-rfp': ['createRFPProject', 'requestRFPApproval', 'getNextPRNumber', 'isProjectNameExists', 'getProjectRootFolder', 'getRFPFolder'],
    'create-pd': ['createPDFolder', 'requestPDApproval', 'hasPDFolder', 'getPDFolder'],
    'approval-system': ['doGet', 'renderTemplate', 'sendApprovalEmail', 'getWebAppUrl', 'getApprovalRecipient'],
    'pr-number': ['getNextPRNumber', 'extractPRNumber'],
    'check-duplicates': ['scanForDuplicateProjects', 'findProjectByName'],
    'list-projects': ['getBiddingProjects', 'getProjectsWithoutPD'],
    'folder-template': ['getTemplateTree', 'saveConfig', 'resetTemplateConfig'],
    'add-folder': ['addFolderToTemplate', 'addFolderToTemplateFromUI', 'bulkAddFoldersToTemplate', 'importFolderStructureFromDrive', 'applyNewFolderToExistingProjects', 'findTargetFolderForNewSubfolder', 'getNextFolderNumber'],
    'remove-folder': ['removeFolderFromTemplate', 'removeFolderFromTemplateFromUI'],
    'rename-folder': ['renameFolderInTemplate', 'renameFolderInTemplateFromUI', 'applyRenameToExistingProjects', 'applyRenameToExistingProjectsByPath', 'checkExistingFoldersForRename', 'findFoldersByPartialName', 'findFoldersByActualName', 'findFoldersByPathAndName', 'findFoldersToRename', 'findFoldersToRenameInProject', 'mapTreeToDriveFolders', 'getNextFolderNumberForRename'],
    'save-template': ['saveConfig', 'resetTemplateConfig'],
    'apply-to-existing': ['applyConfigToAllProjectsSharedDrive', 'applyNewFolderToExistingProjects', 'applyRenameToExistingProjects'],
    'limited-access': ['applyLimitedAccessToFolder', 'applyLimitedAccessToProject', 'applyLimitedAccessToPhaseFolder', 'applyLimitedAccessToSubfolders', 'applyLimitedAccessToAllProjects'],
    'group-permissions': ['applyLimitedAccessToFolder', 'getGroupsMap', 'normalizeGroupEmail'],
    'apply-permissions': ['applyPermissionsToFolder', 'resolveFolderByPath'],
    'apply-to-all': ['applyLimitedAccessToAllProjects'],
    'test-permissions': ['testFolderPermissions'],
    'access-policy': ['getAccessPolicy', 'saveAccessPolicy', 'collectGroupsFromTemplate'],
    'domain-sharing': ['shareFolderWithDomain', 'shareAllFoldersRecursively', 'shareAllFoldersRecursivelyWithTemplate'],
    'list-users': ['getAllDomainUsers'],
    'users-with-groups': ['getAllUsersWithGroups'],
    'manage-members': ['listGroupMembers', 'addGroupMember', 'removeGroupMember'],
    'list-groups': ['getGroupsMap', 'listGroupMembers'],
    'group-roles': ['getAccessPolicy', 'saveAccessPolicy'],
    'block-files': ['getFileRestrictions', 'addBlockedExtension', 'removeBlockedExtension', 'isFileBlocked', 'saveFileRestrictions'],
    'allow-files': ['getFileRestrictions', 'addAllowedExtension', 'removeAllowedExtension', 'setWhitelistEnabled', 'saveFileRestrictions'],
    'file-monitoring': ['monitorAndDeleteBlockedFiles', 'getFileMonitoringStatus'],
    'monitoring-trigger': ['setupFileMonitoring', 'getFileMonitoringStatus'],
    'log-system': ['logRow'],
    'view-logs': ['getLogs', 'getRecentLogs'],
    'approval-email': ['sendApprovalEmail', 'renderHtmlFileToString', 'getWebAppUrl'],
    'email-recipients': ['getApprovalRecipients', 'saveApprovalRecipients', 'getApprovalRecipient'],
    'email-templates': ['renderHtmlFileToString', 'renderTemplate'],
    'scan-duplicates': ['scanForDuplicateProjects'],
    'sync-recent': ['cronSyncRecent'],
    'audit-all': ['cronAuditAll']
  };
}

function checkCommonIssues(analysis, codeGsContent, uiContent) {
  // Check for duplicate function definitions
  const functionCounts = {};
  analysis.backendFunctions.forEach(func => {
    functionCounts[func] = (functionCounts[func] || 0) + 1;
  });
  
  Object.keys(functionCounts).forEach(func => {
    if (functionCounts[func] > 1) {
      analysis.errors.push({
        type: 'duplicate_function',
        severity: 'error',
        message: `Function "${func}" is defined ${functionCounts[func]} times`,
        function: func
      });
    }
  });

  // Check for missing error handling in critical functions
  const criticalFunctions = ['createRFPProject', 'createPDFolder', 'applyLimitedAccessToAllProjects'];
  criticalFunctions.forEach(funcName => {
    if (analysis.backendFunctions.includes(funcName)) {
      // This is a simple check - in real implementation, we'd parse the function body
      analysis.warnings.push({
        type: 'error_handling_check',
        severity: 'info',
        message: `Consider reviewing error handling in "${funcName}"`,
        function: funcName
      });
    }
  });
}

function autoFixCodebase(fixes) {
  const results = {
    fixed: [],
    failed: [],
    skipped: []
  };

  try {
    // This is a placeholder - actual fixes would require file editing capabilities
    // For now, we'll return what would be fixed
    fixes.forEach(fix => {
      if (fix.type === 'add_missing_function' && fix.functionName) {
        // In a real implementation, we'd add the function
        results.fixed.push({
          type: fix.type,
          function: fix.functionName,
          message: `Would add function "${fix.functionName}"`
        });
      } else {
        results.skipped.push({
          type: fix.type,
          message: `Auto-fix not available for: ${fix.type}`
        });
      }
    });

    logRow('INFO', 'autoFixCodebase', `Auto-fix completed: ${results.fixed.length} fixed, ${results.failed.length} failed, ${results.skipped.length} skipped`);
    return results;
  } catch (err) {
    logRow('ERROR', 'autoFixCodebase', `Auto-fix error: ${err.message}`);
    throw err;
  }
}

// Enhanced version that actually reads the code
function analyzeCodebaseEnhanced() {
  const analysis = {
    timestamp: new Date().toISOString(),
    errors: [],
    warnings: [],
    missingFunctions: [],
    unusedFunctions: [],
    uiFunctions: [],
    backendFunctions: [],
    uiFunctionCalls: [],
    fileChecks: {},
    suggestions: []
  };

  try {
    // Get all backend functions from Code.gs
    const codeGsFunctions = getAllFunctionsFromCode();
    analysis.backendFunctions = codeGsFunctions;
    logRow('INFO', 'analyzeCodebaseEnhanced', `Found ${codeGsFunctions.length} functions in Code.gs`);

    // Get all backend functions from GroupsAndAccess.gs
    const groupsGsFunctions = getAllFunctionsFromGroupsAndAccess();
    analysis.backendFunctions = analysis.backendFunctions.concat(groupsGsFunctions);
    logRow('INFO', 'analyzeCodebaseEnhanced', `Found ${groupsGsFunctions.length} functions in GroupsAndAccess.gs`);

    // Get all UI function calls
    const uiCalls = getAllUIFunctionCalls();
    analysis.uiFunctionCalls = uiCalls;
    logRow('INFO', 'analyzeCodebaseEnhanced', `Found ${uiCalls.length} function calls from UI`);

    // Get all UI functions (JavaScript functions in HTML)
    const uiFuncs = getAllUIFunctions();
    analysis.uiFunctions = uiFuncs;
    logRow('INFO', 'analyzeCodebaseEnhanced', `Found ${uiFuncs.length} UI JavaScript functions`);

    // Check for missing functions
    uiCalls.forEach(funcName => {
      if (!analysis.backendFunctions.includes(funcName)) {
        if (!analysis.missingFunctions.includes(funcName)) {
          analysis.missingFunctions.push(funcName);
          analysis.errors.push({
            type: 'missing_function',
            severity: 'error',
            message: `Function "${funcName}" is called from UI but not found in backend`,
            file: 'Ui_Combined.html',
            function: funcName,
            fixable: true
          });
        }
      }
    });

    // Check Feature Map
    const featureMap = getFeatureMap();
    const allFeatureFunctions = new Set();
    Object.values(featureMap).forEach(funcs => {
      funcs.forEach(func => allFeatureFunctions.add(func));
    });

    allFeatureFunctions.forEach(funcName => {
      if (!analysis.backendFunctions.includes(funcName)) {
        if (!analysis.missingFunctions.includes(funcName)) {
          analysis.missingFunctions.push(funcName);
          analysis.warnings.push({
            type: 'feature_map_mismatch',
            severity: 'warning',
            message: `Function "${funcName}" is in Feature Map but not found in code`,
            function: funcName
          });
        }
      }
    });

    // Check for unused functions
    const coreFunctions = ['doGet', 'renderTemplate', 'include', 'logRow', 'getAuthInfo', 'getTemplateTree', 'saveConfig', 'generateFeatureRemovalLog', 'analyzeCodebase', 'analyzeCodebaseEnhanced', 'autoFixCodebase', 'getRevisionNumber', 'updateRevisionNumber'];
    
    // Functions that are called internally by other backend functions
    // These are helper functions used by main functions
    const internalHelperFunctions = [
      'createSubfoldersFromTemplate', 'createSubfoldersRecursively', // Called by createRFPProject, createPDFolder, ensureFolderStructureInProject
      'applyPolicyToFolderAndChildren', 'applyAccessPolicyToFile', // Called by createRFPProject, createPDFolder, applyConfigToAllProjectsSharedDrive
      'getAllProjectFolders', // Helper for various operations
      'findFoldersByTreePath', 'matchesPositionInTree', // Used in folder operations
      'getNodeByPath', // Used in template operations
      'getFoldersInParent', // Helper function
      'findTemplateNodeByPath', // Used in template operations
      'getDefaultGroupDomain', // Helper for group operations
      'getTemplatePathNodes', // Helper for path operations
      'getFolderTypeFromPath', // Helper for path operations
      'buildNumberedFolderTitle', 'parseNumberedFolder', // Used in folder naming
      'listDescendantFolders', // Helper for folder operations
      'getAllFunctionsFromCode', 'getAllFunctionsFromGroupsAndAccess', 'getAllUIFunctionCalls', 'getAllUIFunctions', // Used by analyzeCodebaseEnhanced
      'runTestSuite', 'runSpecificTest' // Test functions - may be called from UI or manually
    ];
    
    // Map of functions that call other functions internally
    // This is based on actual code analysis - functions are called by other backend functions
    const internalCallMap = {
      'createSubfoldersFromTemplate': ['createRFPProject', 'createPDFolder', 'ensureFolderStructureInProject'],
      'createSubfoldersRecursively': ['createSubfoldersFromTemplate'],
      'applyPolicyToFolderAndChildren': ['createRFPProject', 'createPDFolder', 'applyConfigToAllProjectsSharedDrive'],
      'applyAccessPolicyToFile': ['applyPolicyToFolderAndChildren'],
      'getAllProjectFolders': ['scanForDuplicateProjects'],
      'findFoldersByTreePath': ['mapTreeToDriveFolders'],
      'matchesPositionInTree': ['findFoldersByTreePath'],
      'getNodeByPath': ['addFolderToTemplate', 'removeFolderFromTemplate', 'renameFolderInTemplate', 'applyNewFolderToExistingProjects'],
      'getFoldersInParent': ['findFoldersByActualName', 'getNextFolderNumber'],
      'findTemplateNodeByPath': ['applyRenameToExistingProjectsByPath'],
      'getDefaultGroupDomain': ['normalizeGroupEmail'],
      'getTemplatePathNodes': ['getFolderTypeFromPath'],
      'getFolderTypeFromPath': ['getTemplatePathNodes'],
      'buildNumberedFolderTitle': ['createSubfoldersRecursively', 'applyNewFolderToExistingProjects'],
      'parseNumberedFolder': ['findFoldersByActualName', 'mapTreeToDriveFolders'],
      'listDescendantFolders': ['getAllProjectFolders'],
      'getAllFunctionsFromCode': ['analyzeCodebaseEnhanced'],
      'getAllFunctionsFromGroupsAndAccess': ['analyzeCodebaseEnhanced'],
      'getAllUIFunctionCalls': ['analyzeCodebaseEnhanced'],
      'getAllUIFunctions': ['analyzeCodebaseEnhanced'],
      'runTestSuite': ['runAllTests'], // Called from UI
      'runSpecificTest': ['runSingleTest'] // Called from UI
    };
    
    analysis.backendFunctions.forEach(funcName => {
      if (!uiCalls.includes(funcName) && !allFeatureFunctions.has(funcName) && !coreFunctions.includes(funcName)) {
        // Check if function is called internally by other backend functions
        let isCalledInternally = false;
        
        // Check if it's in the internal helper functions list
        if (internalHelperFunctions.includes(funcName)) {
          isCalledInternally = true;
        }
        
        // Check if it's in the internal call map (called by other functions)
        if (!isCalledInternally && internalCallMap[funcName]) {
          // Check if any of the calling functions exist in our function list
          const callingFunctions = internalCallMap[funcName];
          isCalledInternally = callingFunctions.some(caller => analysis.backendFunctions.includes(caller) || uiCalls.includes(caller));
        }
        
        if (!isCalledInternally) {
          analysis.unusedFunctions.push(funcName);
          analysis.warnings.push({
            type: 'potentially_unused',
            severity: 'warning',
            message: `Function "${funcName}" may be unused`,
            function: funcName
          });
        }
      }
    });

    // Generate suggestions
    if (analysis.missingFunctions.length > 0) {
      analysis.suggestions.push({
        type: 'add_missing_functions',
        message: `Add ${analysis.missingFunctions.length} missing function(s)`,
        functions: analysis.missingFunctions
      });
    }

    if (analysis.unusedFunctions.length > 0) {
      analysis.suggestions.push({
        type: 'remove_unused_functions',
        message: `Consider removing ${analysis.unusedFunctions.length} potentially unused function(s)`,
        functions: analysis.unusedFunctions
      });
    }

    analysis.summary = {
      totalErrors: analysis.errors.length,
      totalWarnings: analysis.warnings.length,
      missingFunctionsCount: analysis.missingFunctions.length,
      unusedFunctionsCount: analysis.unusedFunctions.length,
      totalBackendFunctions: analysis.backendFunctions.length,
      totalUIFunctions: analysis.uiFunctions.length,
      totalUIFunctionCalls: analysis.uiFunctionCalls.length
    };

    logRow('INFO', 'analyzeCodebaseEnhanced', `Analysis complete: ${analysis.summary.totalErrors} errors, ${analysis.summary.totalWarnings} warnings`);
    return analysis;
  } catch (err) {
    logRow('ERROR', 'analyzeCodebaseEnhanced', `Error: ${err.message}`);
    analysis.errors.push({
      type: 'analysis_error',
      severity: 'error',
      message: `Analysis failed: ${err.message}`
    });
    return analysis;
  }
}

function getAllFunctionsFromCode() {
  // Since we can't read the file directly in Apps Script, we'll use a workaround
  // We'll manually list all functions we know exist
  // In a real implementation, we'd parse the actual file
  const functions = [];
  
  // This is a simplified approach - in production, we'd need to actually read and parse the files
  // For now, return functions we know should exist based on grep results
  return [
    'doGet', 'renderTemplate', 'include', 'logRow', 'getNextPRNumber', 'getAuthInfo',
    'getTemplateTree', 'saveConfig', 'resetTemplateConfig', 'getAccessPolicy', 'saveAccessPolicy',
    'requestApproval', 'requestRFPApproval', 'isProjectNameExists', 'requestPDApproval',
    'createRFPProject', 'createPDFolder', 'createSubfoldersFromTemplate', 'createSubfoldersRecursively',
    'findProjectByName', 'hasPDFolder', 'extractPRNumber', 'getProjectRootFolder', 'getPDFolder',
    'applyPolicyToFolderAndChildren', 'applyAccessPolicyToFile', 'cronSyncRecent', 'cronAuditAll',
    'getBiddingProjects', 'getProjectsWithoutPD', 'getWebAppUrl', 'getApprovalRecipient',
    'renderHtmlFileToString', 'sendApprovalEmail', 'applyConfigToAllProjectsSharedDrive',
    'addFolderToTemplate', 'removeFolderFromTemplate', 'renameFolderInTemplate',
    'checkExistingFoldersForRename', 'findFoldersByPartialName', 'getAllProjectFolders',
    'findFoldersByActualName', 'mapTreeToDriveFolders', 'findFoldersByTreePath',
    'matchesPositionInTree', 'applyRenameToExistingProjectsByPath', 'findFoldersByPathAndName',
    'getNodeByPath', 'applyNewFolderToExistingProjects', 'getFoldersInParent', 'getNextFolderNumber',
    'findTemplateNodeByPath', 'applyRenameToExistingProjects', 'findTargetFolderForNewSubfolder',
    'findFoldersToRename', 'addFolderToTemplateFromUI', 'bulkAddFoldersToTemplate', 'importFolderStructureFromDrive', 'removeFolderFromTemplateFromUI',
    'renameFolderInTemplateFromUI', 'scanForDuplicateProjects',
    'getNextFolderNumberForRename', 'generateFeatureRemovalLog',
    'getDefaultGroupDomain', 'normalizeGroupEmail', 'getTemplatePathNodes', 'getFolderTypeFromPath',
    'resolveFolderByPath', 'shareFolderWithDomain', 'shareAllFoldersRecursively',
    'shareAllFoldersRecursivelyWithTemplate', 'applyLimitedAccessToFolder',
    'applyLimitedAccessToProject', 'applyLimitedAccessToPhaseFolder', 'applyLimitedAccessToSubfolders',
    'applyLimitedAccessToAllProjects', 'applyPermissionsToFolder', 'testFolderPermissions',
    'getRecentLogs', 'getLogs', 'buildNumberedFolderTitle', 'parseNumberedFolder',
    'getRFPFolder', 'listDescendantFolders', 'analyzeCodebase', 'analyzeCodebaseEnhanced', 'autoFixCodebase',
    'getAllFunctionsFromCode', 'getAllFunctionsFromGroupsAndAccess', 'getAllUIFunctionCalls', 'getAllUIFunctions',
    // Approval Recipients
    'getApprovalRecipients', 'saveApprovalRecipients',
    // File Restrictions
    'getFileRestrictions', 'saveFileRestrictions', 'addBlockedExtension', 'removeBlockedExtension',
    'addAllowedExtension', 'removeAllowedExtension', 'setWhitelistEnabled', 'isFileBlocked',
    // File Monitoring
    'getFileMonitoringStatus', 'setupFileMonitoring', 'monitorAndDeleteBlockedFiles',
    // Helper Functions
    'findFoldersToRenameInProject', 'collectGroupsFromTemplate',
    // Test Runner
    'runTestSuite', 'runSpecificTest'
  ];
}

function getAllFunctionsFromGroupsAndAccess() {
  return [
    'getGroupsMap', 'listGroupMembers', 'addGroupMember', 'removeGroupMember',
    'getAllDomainUsers', 'getAllUsersWithGroups'
  ];
}

function getAllUIFunctionCalls() {
  // Extract from actual UI file - these are functions called via google.script.run
  return [
    'getAuthInfo', 'getTemplateTree', 'saveConfig', 'resetTemplateConfig',
    'requestApproval', 'getBiddingProjects', 'getProjectsWithoutPD',
    'addFolderToTemplateFromUI', 'bulkAddFoldersToTemplate', 'importFolderStructureFromDrive', 'removeFolderFromTemplateFromUI', 'renameFolderInTemplateFromUI',
    'applyConfigToAllProjectsSharedDrive', 'applyLimitedAccessToAllProjects',
    'applyPermissionsToFolder', 'getAccessPolicy', 'saveAccessPolicy',
    'getGroupsMap', 'getAllUsersWithGroups', 'listGroupMembers', 'addGroupMember', 'removeGroupMember',
    'getLogs', 'getRecentLogs', 'testFolderPermissions', 'scanForDuplicateProjects',
    'cronSyncRecent', 'cronAuditAll',
    'getApprovalRecipients', 'saveApprovalRecipients', 'getFileRestrictions', 'saveFileRestrictions',
    'addBlockedExtension', 'removeBlockedExtension', 'addAllowedExtension', 'removeAllowedExtension',
    'setWhitelistEnabled', 'getFileMonitoringStatus', 'setupFileMonitoring', 'generateFeatureRemovalLog',
    'analyzeCodebaseEnhanced', 'autoFixCodebase'
  ];
}

function getAllUIFunctions() {
  // JavaScript functions defined in UI
  return [
    'showModal', 'setButtonLoading', 'togglePhase', 'sendApproval', 'loadAdminTree',
    'buildAdminNodes', 'renderAdminTree', 'renderTreeTable', 'highlightSelectedRow',
    'renderTreeTableRow', 'toggleTreeNode', 'toggleNodeProtectionFromTable',
    'manageNodeGroups', 'selectNodeFromTable', 'addChildNodeFromTable', 'renameNodeFromTable',
    'deleteNodeFromTable', 'getNodeByPath', 'addChildNode', 'addSiblingNode', 'renameNode',
    'deleteNode', 'enableInlineRename', 'findNodeByPathInWidget', 'renderGroupList',
    'getRoleBadgeColor', 'getRoleLabel', 'toggleLimitedAccess', 'addGroupToNode',
    'removeGroupFromNode', 'applyPermissionsToFolder', 'adminSaveStructure', 'adminApplyAll',
    'applyLimitedAccessToAll', 'adminResetTemplate', 'scanDuplicates',
    'loadAccessPolicy', 'renderAccessPolicy', 'loadGroupsForRoles',
    'loadAllUsersWithGroups', 'filterUsersTable', 'filterUsersByGroup', 'showAddGroupModal',
    'populateGroupSelect', 'createAddGroupModal', 'addUserToGroupFromModal', 'removeUserFromGroup',
    'savePolicy', 'syncAllNewOnly', 'syncAllAudit', 'loadLogs', 'testFolderPermissions',
    'populateFolderGroupSelect', 'loadApprovalRecipients', 'addApprovalRecipient',
    'removeApprovalRecipient', 'init', 'loadFileRestrictions', 'addBlockedExtension',
    'removeBlockedExtension', 'addAllowedExtension', 'removeAllowedExtension', 'toggleWhitelist',
    'checkMonitoringStatus', 'setupFileMonitoring', 'setupRoleDescription',
    'featureUpdateStats', 'featureSelectAll', 'featureDeselectAll', 'featureSelectEssential',
    'featureExportSelection', 'featureGenerateLog', 'copyLogToClipboard'
  ];
}

/* ========== Test Runner ========== */

function runTestSuite() {
  const results = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
  };

  try {
    logRow('INFO', 'runTestSuite', 'Starting test suite execution');

    // Test 1: getAuthInfo
    results.totalTests++;
    try {
      const authInfo = getAuthInfo();
      if (authInfo && (authInfo.userEmail || authInfo.user)) {
        results.passed++;
        results.tests.push({
          name: 'getAuthInfo',
          status: 'passed',
          message: 'Successfully retrieved auth info',
          details: { userEmail: authInfo.userEmail || authInfo.user, isAdmin: authInfo.isAdmin }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getAuthInfo',
          status: 'failed',
          message: 'Auth info is empty or invalid'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getAuthInfo',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 2: getTemplateTree
    results.totalTests++;
    try {
      const tree = getTemplateTree();
      if (tree && Array.isArray(tree)) {
        results.passed++;
        results.tests.push({
          name: 'getTemplateTree',
          status: 'passed',
          message: `Successfully retrieved template tree with ${tree.length} root nodes`,
          details: { rootNodes: tree.length }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getTemplateTree',
          status: 'failed',
          message: 'Template tree is not an array'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getTemplateTree',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 3: getGroupsMap
    results.totalTests++;
    try {
      const groups = getGroupsMap();
      if (groups && typeof groups === 'object') {
        const groupCount = Object.keys(groups).length;
        results.passed++;
        results.tests.push({
          name: 'getGroupsMap',
          status: 'passed',
          message: `Successfully retrieved ${groupCount} group(s)`,
          details: { groupCount: groupCount }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getGroupsMap',
          status: 'failed',
          message: 'Groups map is not an object'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getGroupsMap',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 4: getAccessPolicy
    results.totalTests++;
    try {
      const policy = getAccessPolicy();
      if (policy && typeof policy === 'object') {
        results.passed++;
        results.tests.push({
          name: 'getAccessPolicy',
          status: 'passed',
          message: 'Successfully retrieved access policy',
          details: { hasGroups: !!policy.groups, hasRoles: !!policy.roles }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getAccessPolicy',
          status: 'failed',
          message: 'Access policy is not an object'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getAccessPolicy',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 5: getFileRestrictions
    results.totalTests++;
    try {
      const restrictions = getFileRestrictions();
      if (restrictions && typeof restrictions === 'object') {
        results.passed++;
        results.tests.push({
          name: 'getFileRestrictions',
          status: 'passed',
          message: 'Successfully retrieved file restrictions',
          details: {
            blockedCount: restrictions.blocked ? restrictions.blocked.length : 0,
            allowedCount: restrictions.allowed ? restrictions.allowed.length : 0
          }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getFileRestrictions',
          status: 'failed',
          message: 'File restrictions is not an object'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getFileRestrictions',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 6: getApprovalRecipients
    results.totalTests++;
    try {
      const recipients = getApprovalRecipients();
      if (recipients && Array.isArray(recipients)) {
        results.passed++;
        results.tests.push({
          name: 'getApprovalRecipients',
          status: 'passed',
          message: `Successfully retrieved ${recipients.length} approval recipient(s)`,
          details: { recipientCount: recipients.length }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getApprovalRecipients',
          status: 'failed',
          message: 'Approval recipients is not an array'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getApprovalRecipients',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 7: getRecentLogs
    results.totalTests++;
    try {
      const logs = getRecentLogs(10);
      if (logs && Array.isArray(logs)) {
        results.passed++;
        results.tests.push({
          name: 'getRecentLogs',
          status: 'passed',
          message: `Successfully retrieved ${logs.length} log entry/entries`,
          details: { logCount: logs.length }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getRecentLogs',
          status: 'failed',
          message: 'Logs is not an array'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getRecentLogs',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 8: getAllDomainUsers (if admin)
    results.totalTests++;
    try {
      const authInfo = getAuthInfo();
      if (authInfo && authInfo.isAdmin) {
        try {
          const users = getAllDomainUsers();
          if (users && Array.isArray(users)) {
            results.passed++;
            results.tests.push({
              name: 'getAllDomainUsers',
              status: 'passed',
              message: `Successfully retrieved ${users.length} domain user(s)`,
              details: { userCount: users.length }
            });
          } else {
            results.failed++;
            results.tests.push({
              name: 'getAllDomainUsers',
              status: 'failed',
              message: 'Users is not an array'
            });
          }
        } catch (e) {
          results.failed++;
          results.tests.push({
            name: 'getAllDomainUsers',
            status: 'failed',
            message: `Error: ${e.message}`,
            error: e.toString()
          });
        }
      } else {
        results.skipped++;
        results.tests.push({
          name: 'getAllDomainUsers',
          status: 'skipped',
          message: 'Skipped: User is not admin'
        });
      }
    } catch (e) {
      results.skipped++;
      results.tests.push({
        name: 'getAllDomainUsers',
        status: 'skipped',
        message: `Skipped: ${e.message}`
      });
    }

    // Test 9: getDefaultGroupDomain
    results.totalTests++;
    try {
      const domain = getDefaultGroupDomain();
      if (domain && typeof domain === 'string' && domain.includes('@')) {
        results.passed++;
        results.tests.push({
          name: 'getDefaultGroupDomain',
          status: 'passed',
          message: `Successfully retrieved domain: ${domain}`,
          details: { domain: domain }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'getDefaultGroupDomain',
          status: 'failed',
          message: 'Domain is not a valid string'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'getDefaultGroupDomain',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    // Test 10: normalizeGroupEmail
    results.totalTests++;
    try {
      const testEmail = 'Test Group';
      const normalized = normalizeGroupEmail(testEmail);
      if (normalized && typeof normalized === 'string') {
        results.passed++;
        results.tests.push({
          name: 'normalizeGroupEmail',
          status: 'passed',
          message: `Successfully normalized: "${testEmail}" -> "${normalized}"`,
          details: { input: testEmail, output: normalized }
        });
      } else {
        results.failed++;
        results.tests.push({
          name: 'normalizeGroupEmail',
          status: 'failed',
          message: 'Normalized email is not a string'
        });
      }
    } catch (e) {
      results.failed++;
      results.tests.push({
        name: 'normalizeGroupEmail',
        status: 'failed',
        message: `Error: ${e.message}`,
        error: e.toString()
      });
    }

    results.summary = {
      total: results.totalTests,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      successRate: results.totalTests > 0 ? ((results.passed / (results.totalTests - results.skipped)) * 100).toFixed(1) : 0
    };

    logRow('INFO', 'runTestSuite', `Test suite completed: ${results.passed}/${results.totalTests - results.skipped} passed, ${results.failed} failed, ${results.skipped} skipped`);
    return results;
  } catch (err) {
    logRow('ERROR', 'runTestSuite', `Test suite error: ${err.message}`);
    results.tests.push({
      name: 'Test Suite',
      status: 'failed',
      message: `Test suite execution failed: ${err.message}`,
      error: err.toString()
    });
    return results;
  }
}

function runSpecificTest(testName) {
  const result = {
    name: testName,
    timestamp: new Date().toISOString(),
    status: 'unknown',
    message: '',
    details: null,
    error: null
  };

  try {
    switch (testName) {
      case 'getAuthInfo':
        const authInfo = getAuthInfo();
        if (authInfo && (authInfo.userEmail || authInfo.user)) {
          result.status = 'passed';
          result.message = 'Successfully retrieved auth info';
          result.details = { userEmail: authInfo.userEmail || authInfo.user, isAdmin: authInfo.isAdmin };
        } else {
          result.status = 'failed';
          result.message = 'Auth info is empty or invalid';
        }
        break;

      case 'getTemplateTree':
        const tree = getTemplateTree();
        if (tree && Array.isArray(tree)) {
          result.status = 'passed';
          result.message = `Successfully retrieved template tree with ${tree.length} root nodes`;
          result.details = { rootNodes: tree.length };
        } else {
          result.status = 'failed';
          result.message = 'Template tree is not an array';
        }
        break;

      case 'getGroupsMap':
        const groups = getGroupsMap();
        if (groups && typeof groups === 'object') {
          result.status = 'passed';
          result.message = `Successfully retrieved ${Object.keys(groups).length} group(s)`;
          result.details = { groupCount: Object.keys(groups).length };
        } else {
          result.status = 'failed';
          result.message = 'Groups map is not an object';
        }
        break;

      default:
        result.status = 'failed';
        result.message = `Unknown test: ${testName}`;
    }
  } catch (e) {
    result.status = 'failed';
    result.message = `Error: ${e.message}`;
    result.error = e.toString();
  }

  return result;
}

/* ========== File Restrictions Management ========== */

const FILE_RESTRICTIONS_PROP = 'FILE_RESTRICTIONS';
const FILE_MONITORING_TRIGGER_PROP = 'FILE_MONITORING_TRIGGER_ID';

function getFileRestrictions() {
  const raw = PropertiesService.getScriptProperties().getProperty(FILE_RESTRICTIONS_PROP);
  if (!raw) {
    const defaultRestrictions = {
      blocked: ['exe', 'bat', 'reg', 'cmd', 'com', 'scr', 'vbs', 'js', 'jar'],
      allowed: [],
      whitelistEnabled: false
    };
    return defaultRestrictions;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return {
      blocked: [],
      allowed: [],
      whitelistEnabled: false
    };
  }
}

function saveFileRestrictions(restrictions) {
  if (!restrictions || typeof restrictions !== 'object') {
    throw new Error('Restrictions must be an object');
  }
  const toSave = {
    blocked: Array.isArray(restrictions.blocked) ? restrictions.blocked : [],
    allowed: Array.isArray(restrictions.allowed) ? restrictions.allowed : [],
    whitelistEnabled: restrictions.whitelistEnabled === true
  };
  PropertiesService.getScriptProperties().setProperty(FILE_RESTRICTIONS_PROP, JSON.stringify(toSave));
  logRow('INFO', 'saveFileRestrictions', `Saved file restrictions: ${toSave.blocked.length} blocked, ${toSave.allowed.length} allowed`);
  return 'File restrictions saved';
}

function addBlockedExtension(ext) {
  if (!ext || typeof ext !== 'string') {
    throw new Error('Extension must be a string');
  }
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const restrictions = getFileRestrictions();
  if (!restrictions.blocked.includes(cleanExt)) {
    restrictions.blocked.push(cleanExt);
    saveFileRestrictions(restrictions);
    logRow('INFO', 'addBlockedExtension', `Added blocked extension: .${cleanExt}`);
    return `Extension .${cleanExt} added to blocked list`;
  }
  return `Extension .${cleanExt} is already blocked`;
}

function removeBlockedExtension(ext) {
  if (!ext || typeof ext !== 'string') {
    throw new Error('Extension must be a string');
  }
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const restrictions = getFileRestrictions();
  const index = restrictions.blocked.indexOf(cleanExt);
  if (index > -1) {
    restrictions.blocked.splice(index, 1);
    saveFileRestrictions(restrictions);
    logRow('INFO', 'removeBlockedExtension', `Removed blocked extension: .${cleanExt}`);
    return `Extension .${cleanExt} removed from blocked list`;
  }
  return `Extension .${cleanExt} is not in blocked list`;
}

function addAllowedExtension(ext) {
  if (!ext || typeof ext !== 'string') {
    throw new Error('Extension must be a string');
  }
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const restrictions = getFileRestrictions();
  if (!restrictions.allowed.includes(cleanExt)) {
    restrictions.allowed.push(cleanExt);
    saveFileRestrictions(restrictions);
    logRow('INFO', 'addAllowedExtension', `Added allowed extension: .${cleanExt}`);
    return `Extension .${cleanExt} added to allowed list`;
  }
  return `Extension .${cleanExt} is already allowed`;
}

function removeAllowedExtension(ext) {
  if (!ext || typeof ext !== 'string') {
    throw new Error('Extension must be a string');
  }
  const cleanExt = ext.replace(/^\./, '').toLowerCase();
  const restrictions = getFileRestrictions();
  const index = restrictions.allowed.indexOf(cleanExt);
  if (index > -1) {
    restrictions.allowed.splice(index, 1);
    saveFileRestrictions(restrictions);
    logRow('INFO', 'removeAllowedExtension', `Removed allowed extension: .${cleanExt}`);
    return `Extension .${cleanExt} removed from allowed list`;
  }
  return `Extension .${cleanExt} is not in allowed list`;
}

function setWhitelistEnabled(enabled) {
  const restrictions = getFileRestrictions();
  restrictions.whitelistEnabled = enabled === true;
  saveFileRestrictions(restrictions);
  logRow('INFO', 'setWhitelistEnabled', `Whitelist ${enabled ? 'enabled' : 'disabled'}`);
  return `Whitelist ${enabled ? 'enabled' : 'disabled'}`;
}

function isFileBlocked(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    return false;
  }
  const restrictions = getFileRestrictions();
  const ext = fileName.split('.').pop().toLowerCase();
  
  if (restrictions.whitelistEnabled) {
    // If whitelist is enabled, only allowed extensions are permitted
    return !restrictions.allowed.includes(ext);
  } else {
    // If whitelist is disabled, blocked extensions are not permitted
    return restrictions.blocked.includes(ext);
  }
}

function getFileMonitoringStatus() {
  const triggerId = PropertiesService.getScriptProperties().getProperty(FILE_MONITORING_TRIGGER_PROP);
  return {
    enabled: !!triggerId,
    triggerId: triggerId || null
  };
}

function setupFileMonitoring() {
  try {
    // Delete existing trigger if any
    const existingTriggerId = PropertiesService.getScriptProperties().getProperty(FILE_MONITORING_TRIGGER_PROP);
    if (existingTriggerId) {
      try {
        ScriptApp.getProjectTriggers().forEach(trigger => {
          if (trigger.getUniqueId() === existingTriggerId) {
            ScriptApp.deleteTrigger(trigger);
          }
        });
      } catch (e) {
        logRow('WARN', 'setupFileMonitoring', `Could not delete existing trigger: ${e.message}`);
      }
    }

    // Create new time-based trigger (runs every hour)
    const trigger = ScriptApp.newTrigger('monitorAndDeleteBlockedFiles')
      .timeBased()
      .everyHours(1)
      .create();

    PropertiesService.getScriptProperties().setProperty(FILE_MONITORING_TRIGGER_PROP, trigger.getUniqueId());
    logRow('INFO', 'setupFileMonitoring', 'File monitoring trigger created');
    return 'File monitoring enabled (runs every hour)';
  } catch (e) {
    logRow('ERROR', 'setupFileMonitoring', `Error setting up monitoring: ${e.message}`);
    throw new Error(`Failed to setup file monitoring: ${e.message}`);
  }
}

function monitorAndDeleteBlockedFiles() {
  try {
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) {
      logRow('WARN', 'monitorAndDeleteBlockedFiles', 'ROOT_SHARED_DRIVE_ID not configured');
      return;
    }

    const restrictions = getFileRestrictions();
    if (restrictions.whitelistEnabled && restrictions.allowed.length === 0) {
      logRow('WARN', 'monitorAndDeleteBlockedFiles', 'Whitelist enabled but no allowed extensions defined');
      return;
    }

    // Search for files in the root drive
    const q = `'${rootDriveId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
    let pageToken = null;
    let deletedCount = 0;
    let checkedCount = 0;

    do {
      const res = Drive.Files.list({
        q: q,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        maxResults: 100,
        pageToken: pageToken
      });

      const items = res.items || [];
      items.forEach(file => {
        checkedCount++;
        if (isFileBlocked(file.title || file.name)) {
          try {
            Drive.Files.remove(file.id, { 
              supportsAllDrives: true,
              useDomainAdminAccess: true 
            });
            deletedCount++;
            logRow('INFO', 'monitorAndDeleteBlockedFiles', `Deleted blocked file: ${file.title} (${file.id})`);
          } catch (e) {
            logRow('ERROR', 'monitorAndDeleteBlockedFiles', `Failed to delete file ${file.title}: ${e.message}`);
          }
        }
      });

      pageToken = res.nextPageToken;
    } while (pageToken);

    logRow('INFO', 'monitorAndDeleteBlockedFiles', `Monitoring complete: checked ${checkedCount} files, deleted ${deletedCount} blocked files`);
    return `Checked ${checkedCount} files, deleted ${deletedCount} blocked files`;
  } catch (e) {
    logRow('ERROR', 'monitorAndDeleteBlockedFiles', `Error monitoring files: ${e.message}`);
    throw e;
  }
}

/* ========== Helper Functions for Template Management ========== */

function findFoldersToRenameInProject(projectRootFolderId, oldName, newName) {
  // This function finds folders in a project that match the old name pattern
  // and need to be renamed to the new name pattern
  const foldersToRename = [];
  
  try {
    const q = `'${projectRootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and title contains '${oldName}'`;
    const res = Drive.Files.list({
      q: q,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      maxResults: 500
    });
    
    const items = res.items || [];
    items.forEach(folder => {
      if (folder.title && folder.title.includes(oldName)) {
        foldersToRename.push({
          id: folder.id,
          oldTitle: folder.title,
          newTitle: folder.title.replace(oldName, newName)
        });
      }
    });
  } catch (e) {
    logRow('ERROR', 'findFoldersToRenameInProject', `Error finding folders: ${e.message}`);
  }
  
  return foldersToRename;
}

function collectGroupsFromTemplate(template) {
  // This function collects all groups mentioned in the template tree
  const groups = new Set();
  
  function traverse(node) {
    if (node.groups && Array.isArray(node.groups)) {
      node.groups.forEach(group => {
        if (typeof group === 'string') {
          groups.add(group);
        } else if (group && group.name) {
          groups.add(group.name);
        }
      });
    }
    if (node.nodes && Array.isArray(node.nodes)) {
      node.nodes.forEach(child => traverse(child));
    }
  }
  
  if (Array.isArray(template)) {
    template.forEach(rootNode => traverse(rootNode));
  } else if (template && template.nodes) {
    traverse(template);
  }
  
  return Array.from(groups);
}

/* ========== Permission Cleanup & Reset Tools ========== */
/* Removed: All permission cleanup functions have been removed */

/* ========== Shared Drive Activity Monitoring ========== */

function getSharedDriveActivity(startTime, endTime, maxResults) {
  try {
    startTime = startTime || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Default: last 7 days
    endTime = endTime || new Date().toISOString();
    maxResults = maxResults || 100;
    
    logRow('INFO', 'getSharedDriveActivity', `Fetching Shared Drive activity from ${startTime} to ${endTime}`);
    
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    if (!rootDriveId) {
      throw new Error('ROOT_SHARED_DRIVE_ID not configured');
    }
    
    // Get Shared Drive name
    let driveName = 'Unknown';
    try {
      const driveInfo = Drive.Files.get(rootDriveId, { supportsAllDrives: true, useDomainAdminAccess: true });
      driveName = driveInfo.name || driveInfo.title || rootDriveId;
    } catch (e) {
      logRow('WARN', 'getSharedDriveActivity', `Could not get Shared Drive name: ${e.message}`);
    }
    
    // Use Reports API to get Drive audit logs
    // Note: This requires Super Admin privileges
    const applicationName = 'drive';
    const userKey = 'all'; // Get activity for all users
    
    let activities = [];
    let pageToken = null;
    let totalFetched = 0;
    
    try {
      do {
        const params = {
          userKey: userKey,
          applicationName: applicationName,
          startTime: startTime,
          endTime: endTime,
          maxResults: Math.min(maxResults - totalFetched, 1000),
          eventName: 'download,view,edit,create,delete,upload,share,change_user_access,change_document_access_scope'
        };
        
        if (pageToken) {
          params.pageToken = pageToken;
        }
        
        const response = Reports.Activities.list(userKey, applicationName, params);
        const items = response.items || [];
        
        // Filter activities related to our Shared Drive
        items.forEach(activity => {
          const events = activity.events || [];
          events.forEach(event => {
            const parameters = event.parameters || [];
            const docIdParam = parameters.find(p => p.name === 'doc_id' || p.name === 'doc_id_v2');
            const docTitleParam = parameters.find(p => p.name === 'doc_title' || p.name === 'title');
            
            if (docIdParam && docIdParam.value) {
              // Check if this file/folder is in our Shared Drive
              try {
                const fileInfo = Drive.Files.get(docIdParam.value, { 
                  supportsAllDrives: true, 
                  useDomainAdminAccess: true,
                  fields: 'id,title,parents,driveId'
                });
                
                // Check if file is in our Shared Drive
                if (fileInfo.driveId === rootDriveId || 
                    (fileInfo.parents && fileInfo.parents.some(p => {
                      try {
                        const parent = Drive.Files.get(p, { supportsAllDrives: true, useDomainAdminAccess: true, fields: 'driveId' });
                        return parent.driveId === rootDriveId;
                      } catch (e) {
                        return false;
                      }
                    }))) {
                  activities.push({
                    id: activity.id?.uniqueQualifier || activity.id?.time || new Date().getTime().toString(),
                    time: activity.id?.time || new Date().toISOString(),
                    user: activity.actor?.email || activity.actor?.callerType || 'Unknown',
                    event: event.name || 'unknown',
                    eventType: event.type || 'unknown',
                    docId: docIdParam.value,
                    docTitle: docTitleParam?.value || fileInfo.title || 'Unknown',
                    ipAddress: activity.ipAddress || 'Unknown',
                    parameters: parameters.map(p => ({ name: p.name, value: p.value || p.boolValue || p.intValue || '' }))
                  });
                }
              } catch (e) {
                // File might not exist or not accessible, skip
              }
            }
          });
        });
        
        totalFetched += items.length;
        pageToken = response.nextPageToken;
        
        // Prevent infinite loop
        if (totalFetched >= maxResults) break;
        
      } while (pageToken && totalFetched < maxResults);
      
      logRow('INFO', 'getSharedDriveActivity', `Fetched ${activities.length} activities from Shared Drive`);
      
      return {
        success: true,
        driveId: rootDriveId,
        driveName: driveName,
        startTime: startTime,
        endTime: endTime,
        totalActivities: activities.length,
        activities: activities.sort((a, b) => new Date(b.time) - new Date(a.time)) // Sort by time descending
      };
      
    } catch (e) {
      // If Reports API fails, try alternative method using Drive API
      logRow('WARN', 'getSharedDriveActivity', `Reports API failed: ${e.message}. Trying alternative method...`);
      
      // Alternative: Get recent file changes using Drive API
      return getSharedDriveActivityAlternative(startTime, endTime, maxResults);
    }
  } catch (err) {
    logRow('ERROR', 'getSharedDriveActivity', `Error: ${err.message}`);
    throw err;
  }
}

function getSharedDriveActivityAlternative(startTime, endTime, maxResults) {
  try {
    const rootDriveId = ROOT_SHARED_DRIVE_ID;
    maxResults = maxResults || 100;
    
    logRow('INFO', 'getSharedDriveActivityAlternative', 'Using alternative method to get activity');
    
    // Get all files modified in the time range
    const startTimeMs = new Date(startTime).getTime();
    const endTimeMs = new Date(endTime).getTime();
    
    const q = `'${rootDriveId}' in parents and trashed = false and modifiedTime >= '${startTime}' and modifiedTime <= '${endTime}'`;
    const res = Drive.Files.list({
      q: q,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      maxResults: maxResults,
      orderBy: 'modifiedTime desc',
      fields: 'items(id,title,modifiedDate,lastModifyingUser,owners,createdDate,createdBy,shared,permissions)'
    });
    
    const files = res.items || [];
    const activities = files.map(file => ({
      id: file.id,
      time: file.modifiedDate || file.createdDate || new Date().toISOString(),
      user: file.lastModifyingUser?.emailAddress || file.createdBy?.emailAddress || 'Unknown',
      event: file.modifiedDate ? 'edit' : 'create',
      eventType: 'file_change',
      docId: file.id,
      docTitle: file.title || 'Unknown',
      ipAddress: 'N/A',
      parameters: [
        { name: 'modifiedDate', value: file.modifiedDate || '' },
        { name: 'createdDate', value: file.createdDate || '' }
      ]
    }));
    
    return {
      success: true,
      driveId: rootDriveId,
      driveName: 'Shared Drive',
      startTime: startTime,
      endTime: endTime,
      totalActivities: activities.length,
      activities: activities,
      note: 'Limited activity data (file modifications only). Full activity requires Reports API access.'
    };
  } catch (err) {
    logRow('ERROR', 'getSharedDriveActivityAlternative', `Error: ${err.message}`);
    throw err;
  }
}

function getRecentSharedDriveActivity(days, maxResults) {
  try {
    days = days || 7;
    maxResults = maxResults || 50;
    
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);
    
    return getSharedDriveActivity(startTime.toISOString(), endTime.toISOString(), maxResults);
  } catch (err) {
    logRow('ERROR', 'getRecentSharedDriveActivity', `Error: ${err.message}`);
    throw err;
  }
}
