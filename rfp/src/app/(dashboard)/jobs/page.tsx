"use client";

import { useState, useEffect } from "react";
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
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    RotateCcw,
    Loader2,
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
        'enforce_permissions': 'Permission Enforcement',
        'build_folder_index': 'Rebuild Folder Index',
        'reconcile_index': 'Reconcile Index',
    };
    return names[type] || type;
}

export default function JobsPage() {
    const [loading, setLoading] = useState(true);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [stats, setStats] = useState({ running: 0, completedToday: 0, failedThisWeek: 0 });
    const [tab, setTab] = useState("all");

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/jobs?status=${tab}`);
            const data = await res.json();

            if (data.success) {
                setJobs(data.jobs || []);
                setStats(data.stats || { running: 0, completedToday: 0, failedThisWeek: 0 });
            }
        } catch (error) {
            console.error('Error fetching jobs:', error);
            toast.error('Failed to load jobs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, [tab]);

    // Auto-refresh when there are running jobs
    useEffect(() => {
        if (stats.running > 0) {
            const interval = setInterval(fetchJobs, 5000);
            return () => clearInterval(interval);
        }
    }, [stats.running]);

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
                    <Button>
                        <Play className="mr-2 h-4 w-4" />
                        New Job
                    </Button>
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

            {/* Active Job Display */}
            {runningJobs.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Active Job</CardTitle>
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
                                    <Button variant="outline" size="sm">
                                        Cancel
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Progress</span>
                                        <span>
                                            {job.completed_tasks || 0} / {job.total_tasks || 0} tasks
                                        </span>
                                    </div>
                                    <Progress value={job.progress || 0} />
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
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Job Type</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Started</TableHead>
                                    <TableHead>Duration</TableHead>
                                    <TableHead>Started By</TableHead>
                                    <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredJobs.map((job) => (
                                    <TableRow key={job.id}>
                                        <TableCell className="font-medium">
                                            {getJobTypeName(job.job_type)}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Progress value={job.progress || 0} className="w-[60px]" />
                                                <span className="text-sm text-muted-foreground">
                                                    {job.progress || 0}%
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(job.created_at).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {job.completed_at
                                                ? `${Math.round(
                                                    (new Date(job.completed_at).getTime() -
                                                        new Date(job.created_at).getTime()) /
                                                    1000
                                                )}s`
                                                : "Running..."}
                                        </TableCell>
                                        <TableCell className="text-sm">{job.triggered_by || 'system'}</TableCell>
                                        <TableCell>
                                            {job.status === "failed" && (
                                                <Button variant="ghost" size="sm">
                                                    <RotateCcw className="mr-1 h-3 w-3" />
                                                    Retry
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
