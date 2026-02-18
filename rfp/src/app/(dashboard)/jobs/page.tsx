"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    Loader2,
    ChevronDown,
    FolderIcon,
    UserPlus,
    UserMinus,
    AlertCircle,
    Info,
    Shield,
    FolderSync,
    Ban,
    Activity,
    Timer,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types (unchanged) ──────────────────────────────────────
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
    status: "info" | "success" | "warning" | "error";
    details: Record<string, unknown>;
    created_at: string;
}

// ─── Helpers (unchanged logic) ──────────────────────────────
function getStatusBadge(status: string) {
    switch (status) {
        case "running":
            return (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/30">
                    <Clock className="mr-1 h-3 w-3" />
                    Running
                </Badge>
            );
        case "pending":
            return (
                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                    <Clock className="mr-1 h-3 w-3" />
                    Pending
                </Badge>
            );
        case "completed":
            return (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/30">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Completed
                </Badge>
            );
        case "failed":
            return (
                <Badge className="bg-red-500/10 text-red-600 border-red-500/30">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                </Badge>
            );
        case "cancelled":
            return (
                <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/30">
                    <Ban className="mr-1 h-3 w-3" />
                    Cancelled
                </Badge>
            );
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

function getJobTypeName(type: string): string {
    const names: Record<string, string> = {
        template_sync_all: "Template Sync - All Projects",
        template_sync_changes: "Template Changes Sync",
        sync_project: "Sync Project",
        permission_enforcement: "Permission Enforcement",
        enforce_permissions: "Enforce Permissions",
        project_sync: "Project Sync",
        build_folder_index: "Rebuild Folder Index",
        rebuild_index: "Rebuild Index",
        reconcile_index: "Reconcile Index",
    };
    return names[type] || type.replace(/_/g, " ");
}

function getJobTypeIcon(type: string) {
    if (type.includes("enforce") || type.includes("permission"))
        return <Shield className="h-4 w-4 text-blue-500" />;
    if (type.includes("sync") || type.includes("index") || type.includes("rebuild"))
        return <FolderSync className="h-4 w-4 text-purple-500" />;
    return <Activity className="h-4 w-4 text-gray-500" />;
}

function getLogIcon(action: string, status: string) {
    if (status === "error")
        return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "warning")
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    switch (action) {
        case "add_permission":
            return <UserPlus className="h-4 w-4 text-green-500" />;
        case "remove_permission":
            return <UserMinus className="h-4 w-4 text-orange-500" />;
        case "start_project":
        case "complete_project":
            return <FolderIcon className="h-4 w-4 text-blue-500" />;
        case "limited_access":
            return <CheckCircle2 className="h-4 w-4 text-purple-500" />;
        default:
            return <Info className="h-4 w-4 text-gray-500" />;
    }
}

function getLogMessage(log: JobLog): string {
    // RPC wraps our data in a nested 'details' object: {details: {our_data}, message, log_status}
    const raw = log.details as Record<string, unknown>;
    const details = ((raw?.details as Record<string, string>) || raw) as Record<string, string>;
    switch (log.action) {
        case "job_started":
            return `Job started by ${details.triggeredBy || "admin"}`;
        case "projects_found":
            return `Found ${details.count} projects to process`;
        case "start_project":
        case "enforce_start":
            return `Processing: ${log.project_name || "project"} (${details.pr_number || ""})`;
        case "folders_found":
            return `Found ${details.count} folders in ${log.project_name}`;
        case "add_permission":
        case "added_group":
        case "added_user":
            return `Added ${details.type || "permission"} for ${details.email} as ${details.role}`;
        case "add_permission_failed":
            return `Failed to add ${details.email}: ${details.error}`;
        case "remove_permission":
        case "removed_permission":
            return `Removed permission: ${details.email} (${details.role || ""})`;
        case "remove_permission_failed":
            return `Failed to remove ${details.email}: ${details.error}`;
        case "limited_access":
        case "set_limited_access":
            return `Set Limited Access: ${details.enabled === "true" ? "enabled" : "disabled"}`;
        case "cleared_limited_access":
            return `Cleared Limited Access`;
        case "scope_parsed":
            return `Scope: ${details.scope || "full"}${details.targetPath ? ` → ${details.targetPath}` : ""}`;
        case "scope_info":
            return `Scope: ${details.scope || "full"} — ${details.totalFolders || 0} folders to process`;
        case "folder_index":
            return `${details.pr_number || log.project_name || "project"}: Indexed ${details.foldersUpserted || 0} of ${details.foldersFound || 0} folders`;
        case "start_reset_apply":
            return `Reset & Apply: ${log.folder_path || "folder"}`;
        case "skip_protected":
            return `Skipped protected: ${details.email}`;
        case "skip_inherited":
            return `Skipped inherited: ${details.email} (${details.role || ""})`;
        case "no_template":
            return `No template match: ${log.folder_path || "folder"}`;
        case "already_removed":
            return `Already removed: ${details.email}`;
        case "complete_project":
        case "enforce_complete":
            return `Completed ${log.project_name || "project"}: ${details.added || 0} added, ${details.removed || details.reverted || 0} removed`;
        case "job_completed": {
            const projects = details.totalProjects || "0";
            const added = details.added ?? details.totalAdded ?? "0";
            const removed = details.removed ?? details.totalReverted ?? "0";
            const errors = details.errors || "0";
            return `Job completed: ${projects} projects, ${added} added, ${removed} removed${errors !== "0" ? `, ${errors} errors` : ""}`;
        }
        case "error":
            return `Error: ${details.message}`;
        case "warning":
            return `Warning: ${details.message}`;
        case "pass1_start":
            return `🔄 PASS 1: GLOBAL RESET — ${details.folderCount || 0} folders`;
        case "pass1_complete":
            return `✅ PASS 1 COMPLETE — All folders reset`;
        case "pass2_start":
            return `🔄 PASS 2: APPLY — ${details.folderCount || 0} folders`;
        case "pass2_complete":
            return `✅ PASS 2 COMPLETE — All folders enforced`;
        case "reset_complete":
            return `Reset complete: ${log.folder_path || "folder"}`;
        case "limited_access_enabled":
            return `Limited Access: enabled`;
        case "limited_access_failed":
            return `Limited Access failed: ${details.error}`;
        case "limited_access_disable_info":
            return `Limited Access: ${details.message}`;
        case "folders_to_process":
            return `${details.count || 0} folders to process (${details.scope || "full"})`;
        case "folder_reset_summary":
            return `↩ Reset: ${details.removed || 0} removed${details.inherited ? `, ${details.inherited} inherited` : ""}${details.laDisabled ? ", LA off" : ""}`;
        case "folder_apply_summary":
            return `✓ Applied: ${details.added || 0} permissions${details.laEnabled ? ", LA on" : ""}`;
        case "folder_missing_in_drive":
            return `⚠ Missing in Drive: ${log.folder_path || details.templatePath || "folder"}`;
        case "add_failed":
            return `Failed to add ${details.email}: ${details.error}`;
        default:
            return log.action.replace(/_/g, " ");
    }
}

function formatElapsed(start: string, end?: string): string {
    const startMs = new Date(start).getTime();
    const endMs = end ? new Date(end).getTime() : Date.now();
    const diff = Math.floor((endMs - startMs) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
}

// ─── Job Log Viewer ─────────────────────────────────────────
function JobLogViewer({ jobId, isActive }: { jobId: string; isActive: boolean }) {
    const [logs, setLogs] = useState<JobLog[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs/${jobId}/logs`);
            const data = await res.json();
            if (data.success) setLogs(data.logs || []);
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchLogs();
        // Only poll while job is still running
        if (isActive) {
            const interval = setInterval(fetchLogs, 2000);
            return () => clearInterval(interval);
        }
    }, [fetchLogs, isActive]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current && isActive) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, isActive]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="py-8 text-center text-sm text-muted-foreground">
                No logs yet. Logs will appear as the job progresses.
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className="max-h-[calc(100vh-680px)] min-h-[200px] overflow-y-auto font-mono text-xs bg-muted/30 border rounded-lg p-2 space-y-0.5"
        >
            {logs.map((log) => (
                <div
                    key={log.id}
                    className={`flex items-start gap-2 px-2 py-1 rounded ${log.status === "error"
                        ? "bg-red-100/50 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                        : log.status === "warning"
                            ? "bg-yellow-100/50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300"
                            : log.status === "success"
                                ? "bg-green-100/30 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                : "text-foreground/80"
                        }`}
                >
                    <div className="mt-0.5 flex-shrink-0">
                        {getLogIcon(log.action, log.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="truncate block">{getLogMessage(log)}</span>
                        {log.folder_path && (
                            <span className="text-[10px] text-gray-500 truncate block">
                                📁 {log.folder_path}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap flex-shrink-0">
                        {new Date(log.created_at).toLocaleTimeString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ─── Job List Item ──────────────────────────────────────────
function JobListItem({
    job,
    isSelected,
    onSelect,
}: {
    job: Job;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const isRunning = job.status === "running";
    return (
        <div
            className={`flex items-center gap-3 py-2.5 px-3 rounded-md cursor-pointer text-sm transition-all ${isSelected
                ? "bg-primary/10 border border-primary/30"
                : "hover:bg-muted/50 border border-transparent"
                } ${isRunning ? "animate-pulse-subtle" : ""}`}
            onClick={onSelect}
        >
            <div className="flex-shrink-0">{getJobTypeIcon(job.job_type)}</div>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">
                    {getJobTypeName(job.job_type)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                    {new Date(job.created_at).toLocaleString()}
                </div>
            </div>
            <div className="flex flex-col items-end gap-1">
                {getStatusBadge(job.status)}
                {isRunning && (
                    <Progress
                        value={job.progress || 0}
                        className="w-[50px] h-1.5"
                    />
                )}
            </div>
        </div>
    );
}

// ─── Job Detail Header ──────────────────────────────────────
function JobDetailHeader({ job }: { job: Job }) {
    const isRunning = job.status === "running";
    const [elapsed, setElapsed] = useState(
        formatElapsed(job.created_at, job.completed_at)
    );

    // Live elapsed timer for running jobs
    useEffect(() => {
        if (!isRunning) {
            setElapsed(formatElapsed(job.created_at, job.completed_at));
            return;
        }
        const interval = setInterval(() => {
            setElapsed(formatElapsed(job.created_at));
        }, 1000);
        return () => clearInterval(interval);
    }, [isRunning, job.created_at, job.completed_at]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {getJobTypeIcon(job.job_type)}
                    <div>
                        <h3 className="font-semibold">
                            {getJobTypeName(job.job_type)}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            Triggered by{" "}
                            <span className="font-medium">
                                {job.triggered_by || "system"}
                            </span>
                        </p>
                    </div>
                </div>
                {getStatusBadge(job.status)}
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Started: {new Date(job.created_at).toLocaleString()}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>Job creation timestamp</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                {job.completed_at && (
                    <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed: {new Date(job.completed_at).toLocaleString()}
                    </span>
                )}
                <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {isRunning ? "Elapsed: " : "Duration: "}{elapsed}
                </span>
            </div>
            {job.error_message && (
                <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/30">
                    {job.error_message}
                </div>
            )}
        </div>
    );
}

// ─── Job Progress ───────────────────────────────────────────
function JobProgress({ job }: { job: Job }) {
    const progress =
        job.status === "completed" || job.status === "failed"
            ? 100
            : job.progress || 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <h4 className="text-sm font-semibold">Progress</h4>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Completion</span>
                    <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5" />
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                        Tasks:{" "}
                        <strong className="text-foreground">
                            {job.completed_tasks || 0}
                        </strong>{" "}
                        / {job.total_tasks || 0}
                    </span>
                    {(job.failed_count ?? 0) > 0 && (
                        <span className="text-red-500">
                            Failed:{" "}
                            <strong>{job.failed_count}</strong>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Stats Row ──────────────────────────────────────────────
function StatsRow({
    stats,
    totalJobs,
}: {
    stats: { running: number; completedToday: number; failedThisWeek: number };
    totalJobs: number;
}) {
    const items = [
        {
            label: "Running",
            value: stats.running,
            icon: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
            bg: "bg-blue-100 dark:bg-blue-900",
        },
        {
            label: "Completed Today",
            value: stats.completedToday,
            icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
            bg: "bg-green-100 dark:bg-green-900",
        },
        {
            label: "Failed",
            value: stats.failedThisWeek,
            icon: <XCircle className="h-5 w-5 text-red-500" />,
            bg: "bg-red-100 dark:bg-red-900",
        },
        {
            label: "Total",
            value: totalJobs,
            icon: <Activity className="h-5 w-5 text-gray-500" />,
            bg: "bg-gray-100 dark:bg-gray-800",
        },
    ];

    return (
        <div className="grid grid-cols-4 gap-4">
            {items.map((s) => (
                <Card key={s.label}>
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full ${s.bg}`}>{s.icon}</div>
                            <div>
                                <p className="text-2xl font-bold">{s.value}</p>
                                <p className="text-sm text-muted-foreground">
                                    {s.label}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────
export default function JobsPage() {
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [projects, setProjects] = useState<{ id: string; name: string; pr_number: string }[]>([]);
    const [stats, setStats] = useState({
        running: 0,
        completedToday: 0,
        failedThisWeek: 0,
    });
    const [tab, setTab] = useState("all");
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [clearingJobs, setClearingJobs] = useState(false);
    const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);

    const fetchJobs = useCallback(async () => {
        try {
            const res = await fetch(`/api/jobs?status=${tab}`);
            const data = await res.json();
            if (data.success) {
                setJobs(data.jobs || []);
                setStats(
                    data.stats || {
                        running: 0,
                        completedToday: 0,
                        failedThisWeek: 0,
                    }
                );
            }
        } catch (error) {
            console.error("Error fetching jobs:", error);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    // Fetch projects for per-project rebuild
    useEffect(() => {
        fetch('/api/projects').then(r => r.json()).then(data => {
            if (data.projects) setProjects(data.projects);
        }).catch(() => { });
    }, []);

    // Auto-refresh only when there are running jobs
    useEffect(() => {
        const hasRunning = jobs.some(j => j.status === 'running');
        if (!hasRunning) return;
        const interval = setInterval(fetchJobs, 5000);
        return () => clearInterval(interval);
    }, [fetchJobs, jobs]);

    // FIX: Stop Job — POST /api/jobs/stop with { jobId }
    const stopJob = async (jobId: string) => {
        setStoppingJobId(jobId);
        try {
            const res = await fetch("/api/jobs/stop", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Job stopped successfully");
                await fetchJobs(); // immediate refresh
            } else {
                toast.error(data.error || "Failed to stop job");
            }
        } catch (error) {
            console.error("Error stopping job:", error);
            toast.error("Failed to stop job");
        } finally {
            setStoppingJobId(null);
        }
    };

    // FIX: Clear Jobs — POST /api/jobs/clear
    const clearAllJobs = async () => {
        const confirmed = confirm(
            "Clear all completed/failed/cancelled jobs from history?"
        );
        if (!confirmed) return;
        setClearingJobs(true);
        try {
            const res = await fetch("/api/jobs/clear", {
                method: "POST",
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Cleared ${data.deleted || 0} jobs`);
                setSelectedJobId(null);
                await fetchJobs(); // immediate refresh
            } else {
                toast.error(data.error || "Failed to clear jobs");
            }
        } catch (error) {
            console.error("Error clearing jobs:", error);
            toast.error("Failed to clear jobs");
        } finally {
            setClearingJobs(false);
        }
    };

    const triggerJob = async (
        jobType: "rebuild_index" | "enforce_permissions",
        body: Record<string, unknown> = {}
    ) => {
        try {
            const endpoint =
                jobType === "rebuild_index"
                    ? "/api/jobs/rebuild-index"
                    : "/api/jobs/enforce-permissions";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    `Started ${jobType === "rebuild_index" ? "Rebuild Index" : "Enforce Permissions"} job`
                );
                await fetchJobs();
            } else {
                toast.error(data.error || `Failed to start ${jobType} job`);
            }
        } catch (error) {
            console.error("Error triggering job:", error);
            toast.error(`Failed to start ${jobType} job`);
        }
    };

    const filteredJobs = jobs.filter((job) => {
        if (tab === "all") return true;
        return job.status === tab;
    });

    const selectedJob = jobs.find((j) => j.id === selectedJobId);
    const isSelectedRunning = selectedJob?.status === "running";

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
                    <p className="text-muted-foreground text-sm">
                        Monitor background sync and enforcement jobs
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={fetchJobs}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllJobs}
                        disabled={clearingJobs}
                        className="text-red-600 hover:text-red-700"
                    >
                        {clearingJobs ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Clear
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm">
                                <Play className="mr-2 h-4 w-4" />
                                New Job
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                                onClick={() => triggerJob("rebuild_index")}
                            >
                                <FolderSync className="mr-2 h-4 w-4" />
                                Rebuild Index (All)
                            </DropdownMenuItem>
                            {projects.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                                        Rebuild Single Project
                                    </DropdownMenuLabel>
                                    <div className="max-h-48 overflow-y-auto">
                                        {projects.map((p) => (
                                            <DropdownMenuItem
                                                key={p.id}
                                                onClick={() => triggerJob("rebuild_index", { projectId: p.id })}
                                                className="text-xs"
                                            >
                                                <FolderSync className="mr-2 h-3 w-3" />
                                                {p.pr_number} — {p.name}
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                    <DropdownMenuSeparator />
                                </>
                            )}
                            <DropdownMenuItem
                                onClick={() => triggerJob("enforce_permissions")}
                            >
                                <Shield className="mr-2 h-4 w-4" />
                                Enforce Permissions
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Stats */}
            <StatsRow stats={stats} totalJobs={jobs.length} />

            {/* Master-Detail */}
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                {/* LEFT: Job List */}
                <Card className="h-[calc(100vh-340px)] flex flex-col">
                    <CardHeader className="py-3 px-4 flex-shrink-0">
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList className="w-full h-8">
                                <TabsTrigger value="all" className="text-xs flex-1">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="running" className="text-xs flex-1">
                                    Running
                                </TabsTrigger>
                                <TabsTrigger value="completed" className="text-xs flex-1">
                                    Done
                                </TabsTrigger>
                                <TabsTrigger value="failed" className="text-xs flex-1">
                                    Failed
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden px-2 pb-2">
                        <ScrollArea className="h-full">
                            <div className="space-y-1">
                                {filteredJobs.map((job) => (
                                    <JobListItem
                                        key={job.id}
                                        job={job}
                                        isSelected={selectedJobId === job.id}
                                        onSelect={() => setSelectedJobId(job.id)}
                                    />
                                ))}
                                {filteredJobs.length === 0 && (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        No jobs found.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* RIGHT: Detail Panel */}
                <div className="h-[calc(100vh-340px)] overflow-hidden">
                    {selectedJob ? (
                        <Card className="h-full flex flex-col">
                            <CardHeader className="py-3 px-4 flex-shrink-0 border-b">
                                <JobDetailHeader job={selectedJob} />
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto px-4 py-3">
                                <div className="space-y-4">
                                    {/* Progress */}
                                    <JobProgress job={selectedJob} />

                                    <div className="border-t" />

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        {isSelectedRunning && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() =>
                                                    stopJob(selectedJob.id)
                                                }
                                                disabled={
                                                    stoppingJobId ===
                                                    selectedJob.id
                                                }
                                            >
                                                {stoppingJobId ===
                                                    selectedJob.id ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Stopping…
                                                    </>
                                                ) : (
                                                    <>
                                                        <Ban className="mr-2 h-4 w-4" />
                                                        Stop Job
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>

                                    <div className="border-t" />

                                    {/* Live Logs */}
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Activity className="h-4 w-4 text-green-500" />
                                            <h4 className="text-sm font-semibold">
                                                {isSelectedRunning
                                                    ? "Live Logs"
                                                    : "Logs"}
                                            </h4>
                                            {isSelectedRunning && (
                                                <span className="flex h-2 w-2">
                                                    <span className="animate-ping absolute h-2 w-2 rounded-full bg-green-400 opacity-75" />
                                                    <span className="relative rounded-full h-2 w-2 bg-green-500" />
                                                </span>
                                            )}
                                        </div>
                                        <JobLogViewer
                                            jobId={selectedJob.id}
                                            isActive={isSelectedRunning || false}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <Activity className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Select a job</p>
                                <p className="text-sm">
                                    Click a job in the list to view its details
                                    and logs
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
