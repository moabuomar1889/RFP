# Feature to Function Mapping

This document maps each feature to its related functions in Code.gs

## Project Management

### create-rfp
- `createRFPProject(pr, projectName)`
- `requestRFPApproval(projectName)`
- `getNextPRNumber()`
- `isProjectNameExists(projectName)`
- `getProjectRootFolder(pr_number, projectName)`

### create-pd
- `createPDFolder(pr, projectName)`
- `requestPDApproval(projectName)`
- `hasPDFolder(projectFolderId)`
- `getPDFolder(projectRootFolderId, pr_number)`

### approval-system
- `doGet(e)` - approve action
- `sendApprovalEmail(pr, projectName, phase)`
- `renderTemplate(fileName, data)`
- `getApprovalRecipient()`
- `getWebAppUrl()`

### pr-number
- `getNextPRNumber()`
- `extractPRNumber(projectTitle)`

### check-duplicates
- `scanForDuplicateProjects()`
- `findProjectByName(projectName)`

## Template Management

### folder-template
- `getTemplateTree()`
- `saveConfig(obj)`
- `resetTemplateConfig()`

### add-folder
- `addFolderToTemplate(parentPath, folderName, folderType)`
- `addFolderToTemplateFromUI(parentPath, folderName, folderType)`
- `applyNewFolderToExistingProjects(parentPath, folderName, folderType)`
- `findTargetFolderForNewSubfolder(projectId, parentPath, pr)`
- `getNextFolderNumber(existingFolders)`

### remove-folder
- `removeFolderFromTemplate(nodePath)`
- `removeFolderFromTemplateFromUI(nodePath)`

### rename-folder
- `renameFolderInTemplate(nodePath, newName)`
- `renameFolderInTemplateFromUI(nodePath, newName)`
- `applyRenameToExistingProjects(nodePath, oldName, newName)`
- `applyRenameToExistingProjectsByPath(nodePath, oldName, newName)`
- `checkExistingFoldersForRename(nodePath, folderName)`
- `findFoldersByPartialName(projectId, nodePath, folderName, pr)`
- `findFoldersByActualName(projectId, nodePath, folderName, pr)`
- `findFoldersByPathAndName(projectId, nodePath, oldName, pr)`
- `findFoldersToRename(projectId, oldName, pr)`
- `findFoldersToRenameInProject(projectId, oldName)`
- `mapTreeToDriveFolders(projectId, nodePath, pr, template)`
- `getNextFolderNumberForRename(existingFolders, excludeFolderId)`

### save-template
- `saveConfig(obj)`
- `resetTemplateConfig()`

### apply-to-existing
- `applyConfigToAllProjectsSharedDrive()`
- `applyNewFolderToExistingProjects(parentPath, folderName, folderType)`
- `applyRenameToExistingProjects(nodePath, oldName, newName)`

## Permissions & Security

### limited-access
- `applyLimitedAccessToFolder(folderId, node)`
- `applyLimitedAccessToProject(projectId, template)`
- `applyLimitedAccessToPhaseFolder(phaseFolderId, template, folderType, pr)`
- `applyLimitedAccessToSubfolders(parentFolderId, nodes, pr, folderType)`
- `applyLimitedAccessToAllProjects()`

### group-permissions
- `applyLimitedAccessToFolder(folderId, node)` - uses groups
- `getGroupsMap()`
- `normalizeGroupEmail(nameOrEmail)`

### apply-permissions
- `applyPermissionsToFolder(nodePath)`
- `resolveFolderByPath(projectId, nodePath, pr, templateNodes, folderType)`

### apply-to-all
- `applyLimitedAccessToAllProjects()`

### test-permissions
- `testFolderPermissions(folderId)`

### access-policy
- `getAccessPolicy()`
- `saveAccessPolicy(policy)`
- `collectGroupsFromTemplate(template)`

## Groups & Members

### list-users
- `getAllDomainUsers()` (in GroupsAndAccess.gs)
- `getAllUsersWithGroups()` (in GroupsAndAccess.gs)

### manage-members
- `listGroupMembers(groupKey)`
- `addGroupMember(groupKey, memberEmail, role)`
- `removeGroupMember(groupKey, memberEmail)`

### list-groups
- `getGroupsMap()`
- `listGroupMembers(groupKey)`

### group-roles
- `getAccessPolicy()`
- `saveAccessPolicy(policy)`

## File Restrictions

### block-files
- `getFileRestrictions()`
- `addBlockedExtension(extension)`
- `removeBlockedExtension(extension)`
- `isFileBlocked(fileName)`

### allow-files
- `getFileRestrictions()`
- `addAllowedExtension(extension)`
- `removeAllowedExtension(extension)`
- `setWhitelistEnabled(enabled)`

### file-monitoring
- `monitorAndDeleteBlockedFiles()`
- `getFileMonitoringStatus()`

### monitoring-trigger
- `setupFileMonitoring()`
- `getFileMonitoringStatus()`

## Logging

### log-system
- `logRow(level, action, message, meta)`

### view-logs
- `getLogs(limit)`
- `getRecentLogs(limit)`

## Email

### approval-email
- `sendApprovalEmail(pr, projectName, phase)`
- `renderHtmlFileToString(fileName, data)`
- `getWebAppUrl()`

### email-recipients
- `getApprovalRecipients()`
- `saveApprovalRecipients(recipients)`
- `getApprovalRecipient()`

## Utilities

### scan-duplicates
- `scanForDuplicateProjects()`

### update-names
- `updateExistingProjectFolderNames()`

### sync-recent
- `cronSyncRecent()`

### audit-all
- `cronAuditAll()`

### test-mapping
- `testTreeToDriveMapping(nodePath, folderName)`

## Helper Functions (Used by multiple features)

### Core Helpers (Keep these)
- `doGet(e)` - Main entry point
- `renderTemplate(fileName, data)` - Template rendering
- `include(filename)` - HTML includes
- `getAuthInfo()` - User authentication
- `getDefaultGroupDomain()` - Domain helper
- `normalizeGroupEmail(nameOrEmail)` - Email normalization
- `getTemplateTree()` - Get template
- `getTemplatePathNodes(nodePath, template)` - Path resolution
- `getFolderTypeFromPath(nodePath)` - Folder type detection
- `buildNumberedFolderTitle(number, pr, folderType, name)` - Title builder
- `parseNumberedFolder(title)` - Title parser
- `getFoldersInParent(parentFolderId)` - List folders
- `getProjectRootFolder(pr_number, projectName)` - Find project
- `getRFPFolder(projectRootFolderId, pr_number)` - Find RFP folder
- `getPDFolder(projectRootFolderId, pr_number)` - Find PD folder
- `shareFolderWithDomain(folderId, skipIfLimitedAccess)` - Domain sharing
- `createSubfoldersRecursively(nodes, parentFolderId, pr, folderType)` - Recursive creation
- `createSubfoldersFromTemplate(parentFolderId, folderType, pr)` - Template-based creation
- `listDescendantFolders(parentId, depthLimit)` - List descendants
- `getAllProjectFolders(parentFolderId)` - Get all folders
- `findNodeByPath(template, path)` - Find node
- `findTemplateNodeByPath(template, path)` - Find template node
- `getNodeByPath(template, path)` - Get node
- `resolveFolderByPath(projectId, nodePath, pr, templateNodes, folderType)` - Resolve path





