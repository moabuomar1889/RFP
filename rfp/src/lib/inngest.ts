import { Inngest } from 'inngest';

// Create a single Inngest client for the app
export const inngest = new Inngest({
    id: 'rfp-system',
    name: 'RFP Project Management System',
});

// Event types
export interface TemplateSyncEvent {
    name: 'template/sync.all';
    data: {
        jobId: string;
        templateVersion: number;
        triggeredBy: string;
    };
}

export interface TemplateSyncChangesEvent {
    name: 'template/sync.changes';
    data: {
        jobId: string;
        fromVersion: number;
        toVersion: number;
        changeIds: string[];
        triggeredBy: string;
    };
}

export interface ProjectSyncEvent {
    name: 'project/sync';
    data: {
        jobId: string;
        projectId: string;
        templateVersion: number;
        triggeredBy: string;
    };
}

export interface PermissionEnforceEvent {
    name: 'permissions/enforce';
    data: {
        jobId: string;
        projectIds?: string[]; // If not provided, enforce all
        triggeredBy: string;
    };
}

export interface FolderIndexBuildEvent {
    name: 'folder-index/build';
    data: {
        jobId: string;
        projectIds?: string[]; // If not provided, build for all
        triggeredBy: string;
    };
}

export interface FolderReconcileEvent {
    name: 'folder-index/reconcile';
    data: {
        jobId: string;
        projectIds?: string[];
        triggeredBy: string;
    };
}

// Union type of all events
export type RFPEvents =
    | TemplateSyncEvent
    | TemplateSyncChangesEvent
    | ProjectSyncEvent
    | PermissionEnforceEvent
    | FolderIndexBuildEvent
    | FolderReconcileEvent;
