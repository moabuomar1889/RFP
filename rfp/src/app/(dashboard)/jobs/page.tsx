"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    RotateCcw,
    Loader2,
    ChevronDown,
    ChevronRight,
    FolderIcon,
    UserPlus,
    UserMinus,
    AlertCircle,
    Info,
    Shield,
    FolderSync,
} from "lucide-react";
import { toast } from "sonner";

interface Job {
    id: string;
    job_type: string;
    status: string;
    progress?: number;
    total_tasks?: number;
    completed_tasks?: number;
    failed_count?: number;
    created_at: string;
    completed_at?: string;
    triggered_by?: string;
    error_message?: string;
}

interface JobLog {
    id: string;
    job_id: string;
    project_id: string | null;
    project_name: string | null;
    folder_path: string | null;
    action: string;
    status: 'info' | 'success' | 'warning' | 'error';
    details: Record<string, unknown>;
    created_at: string;
}

function getStatusBadge(status: string) {
    switch (status) {
        case "running":
            return (
                <Badge className="bg-blue-500">
                    <Clock className="mr-1 h-3 w-3" />
                    Running
                </Badge>
            );
        case "completed":
            return (
                <Badge className="bg-green-500">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Completed
                </Badge>
            );
        case "failed":
            return (
                <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                </Badge>
            );
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

function getJobTypeName(type: string): string {
    const names: Record<string, string> = {
        'template_sync_all': 'Template Sync - All Projects',
        'template_sync_changes': 'Template Changes Sync',
        'sync_project': 'Sync Project',
        'permission_enforcement': 'Permission Enforcement',
        'project_sync': 'Project Sync',
        'build_folder_index': 'Rebuild Folder Index',
        'reconcile_index': 'Reconcile Index',
    };
    return names[type] || type.replace(/_/g, ' ');
}

function getLogIcon(action: string, status: string) {
    if (status === 'error') return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === 'warning') return <AlertCircle className="h-4 w-4 text-yellow-500" />;

    switch (action) {
        case 'add_permission':
            return <UserPlus className="h-4 w-4 text-green-500" />;
        case 'remove_permission':
            return <UserMinus className="h-4 w-4 text-orange-500" />;
        case 'start_project':
        case 'complete_project':
            return <FolderIcon className="h-4 w-4 text-blue-500" />;
        case 'limited_access':
            return <CheckCircle2 className="h-4 w-4 text-purple-500" />;
        default:
            return <Info className="h-4 w-4 text-gray-500" />;
    }
}

function getLogMessage(log: JobLog): string {
    const details = log.details as Record<string, string>;
    switch (log.action) {
        case 'job_started':
            return `Job started by ${details.triggeredBy || 'admin'}`;
        case 'projects_found':
            return `Found ${details.count} projects to process`;
        case 'start_project':
            return `Processing: ${log.project_name} (${details.pr_number})`;
        case 'folders_found':
            return `Found ${details.count} folders in ${log.project_name}`;
        case 'add_permission':
            return `Added ${details.type} permission for ${details.email} as ${details.role}`;
        case 'add_permission_failed':
            return `Failed to add ${details.email}: ${details.error}`;
        case 'remove_permission':
            return `Removed unauthorized permission: ${details.email}`;
        case 'remove_permission_failed':
            return `Failed to remove ${details.email}: ${details.error}`;
        case 'limited_access':
            return `Enabled Limited Access on folder`;
        case 'complete_project':
            return `Completed ${log.project_name}: ${details.added} added, ${details.reverted} removed`;
        case 'job_completed':
            return `Job completed: ${details.totalProjects} projects, ${details.totalAdded} added, ${details.totalReverted} removed`;
        case 'error':
            return `Error: ${details.message}`;
        case 'warning':
            return `Warning: ${details.message}`;
        default:
            return log.action.replace(/_/g, ' ');
    }
}

function JobLogs({ jobId }: { jobId: string }) {
    const [logs, setLogs] = useState<JobLog[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs/${jobId}/logs`);
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs || []);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchLogs();
        // Auto-refresh logs every 2 seconds
        const interval = setInterval(fetchLogs, 2000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="py-4 text-center text-sm text-muted-foreground">
                No detailed logs yet. Logs will appear as the job progresses.
            </div>
        );
    }

    return (
        <div className="max-h-[400px] overflow-y-auto space-y-1 py-2">
            {logs.map((log) => (
                <div
                    key={log.id}
                    className={`flex items-start gap-2 px-2 py-1.5 rounded text-sm ${log.status === 'error' ? 'bg-red-50 dark:bg-red-950' :
                        log.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950' :
                            log.status === 'success' ? 'bg-green-50 dark:bg-green-950' :
                                'bg-gray-50 dark:bg-gray-900'
                        }`}
                >
                    <div className="mt-0.5">{getLogIcon(log.action, log.status)}</div>
                    <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{getLogMessage(log)}</div>
                        {log.folder_path && (
                            <div className="text-xs text-muted-foreground truncate">
                                📁 {log.folder_path}
                            </div>
                        )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleTimeString()}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function JobsPage() {
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [stats, setStats] = useState({ running: 0, completedToday: 0, failedThisWeek: 0 });
    const [tab, setTab] = useState("all");
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());
    const [clearingJobs, setClearingJobs] = useState(false);

    const fetchJobs = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs?status=${tab}`);
            const data = await res.json();

            if (data.success) {
                setJobs(data.jobs || []);
                setStats(data.stats || { running: 0, completedToday: 0, failedThisWeek: 0 });
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    // Auto-refresh every 3 seconds
    useEffect(() => {
        const interval = setInterval(fetchJobs, 3000);
        return () => clearInterval(interval);
    }, [fetchJobs]);

    const toggleExpand = (jobId: string) => {
        setExpandedJobs(prev => {
            const next = new Set(prev);
            if (next.has(jobId)) {
                next.delete(jobId);
            } else {
                next.add(jobId);
            }
            return next;
        });
    };

    const clearAllJobs = async () => {
        setClearingJobs(true);
        try {
            const response = await fetch("/api/jobs/clear", {
                method: "POST",
            });
            const data = await response.json();
            if (data.success) {
                toast.success(`Cleared ${data.deleted} jobs`);
                fetchJobs();
            } else {
                toast.error(data.error || "Failed to clear jobs");
            }
        } catch (error) {
            toast.error("Failed to clear jobs");
        } finally {
            setClearingJobs(false);
        }
    };

    const triggerJob = async (jobType: 'rebuild_index' | 'enforce_permissions') => {
        try {
            const endpoint = jobType === 'rebuild_index'
                ? '/api/sync/rebuild-index'
                : '/api/sync/enforce-permissions';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`Started ${jobType === 'rebuild_index' ? 'Rebuild Index' : 'Enforce Permissions'} job`);
                fetchJobs();
            } else {
                toast.error(data.error || `Failed to start ${jobType} job`);
            }
        } catch (error) {
            console.error('Error triggering job:', error);
            toast.error(`Failed to start ${jobType} job`);
        }
    };

    const filteredJobs = jobs.filter((job) => {
        if (tab === "all") return true;
        return job.status === tab;
    });

    const runningJobs = jobs.filter(j => j.status === 'running');

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
                    <p className="text-muted-foreground">
                        Monitor background sync and enforcement jobs
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchJobs}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        onClick={clearAllJobs}
                        disabled={clearingJobs}
                        className="text-red-600 hover:text-red-700"
                    >
                        {clearingJobs ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <XCircle className="mr-2 h-4 w-4" />
                        )}
                        Clear Jobs
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button>
                                <Play className="mr-2 h-4 w-4" />
                                New Job
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => triggerJob('rebuild_index')}>
                                <FolderSync className="mr-2 h-4 w-4" />
                                Rebuild Index
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => triggerJob('enforce_permissions')}>
                                <Shield className="mr-2 h-4 w-4" />
                                Enforce Permissions
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{stats.running}</div>
                        <p className="text-sm text-muted-foreground">Running</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-500">{stats.completedToday}</div>
                        <p className="text-sm text-muted-foreground">Completed Today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-500">{stats.failedThisWeek}</div>
                        <p className="text-sm text-muted-foreground">Failed This Week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{jobs.length}</div>
                        <p className="text-sm text-muted-foreground">Total Jobs</p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Job Display with Live Logs */}
            {runningJobs.length > 0 && (
                <Card className="border-blue-500 border-2">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                            Active Job
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {runningJobs.map((job) => (
                            <div key={job.id} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{getJobTypeName(job.job_type)}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Started by {job.triggered_by || 'system'}
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress</span>
                                        <span>
                                            {job.completed_tasks || 0} / {job.total_tasks || 0} projects ({job.progress || 0}%)
                                        </span>
                                    </div>
                                    <Progress value={job.progress || 0} className="h-3" />
                                </div>
                                {/* Live Logs */}
                                <div className="border rounded-lg">
                                    <div className="px-3 py-2 bg-muted font-medium text-sm border-b">
                                        Live Logs
                                    </div>
                                    <JobLogs jobId={job.id} />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Jobs List */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Job History</CardTitle>
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="running">Running</TabsTrigger>
                                <TabsTrigger value="completed">Completed</TabsTrigger>
                                <TabsTrigger value="failed">Failed</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardHeader>
                <CardContent>
                    {filteredJobs.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            No jobs found. Jobs will appear here when you run sync or enforce operations.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredJobs.map((job) => (
                                <div key={job.id} className="border rounded-lg">
                                    <div
                                        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/50"
                                        onClick={() => toggleExpand(job.id)}
                                    >
                                        <div className="flex-shrink-0">
                                            {expandedJobs.has(job.id) ? (
                                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium">{getJobTypeName(job.job_type)}</div>
                                            <div className="text-sm text-muted-foreground">
                                                {new Date(job.created_at).toLocaleString()} • {job.triggered_by || 'system'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <Progress value={job.progress || 0} className="w-[60px]" />
                                                <span className="text-sm text-muted-foreground w-10">
                                                    {job.progress || 0}%
                                                </span>
                                            </div>
                                            {getStatusBadge(job.status)}
                                        </div>
                                    </div>
                                    {expandedJobs.has(job.id) && (
                                        <div className="border-t px-4 pb-4">
                                            <JobLogs jobId={job.id} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
