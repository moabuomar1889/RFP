"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    RefreshCw,
    CheckCircle2,
    XCircle,
    Clock,
    Play,
    RotateCcw,
    ChevronDown,
} from "lucide-react";

// Mock jobs data
const jobs = [
    {
        id: "1",
        type: "template_sync_all",
        typeName: "Template Sync - All Projects",
        status: "running",
        progress: 56,
        completedTasks: 18,
        totalTasks: 32,
        startedAt: "2024-01-26T12:00:00Z",
        startedBy: "mo.abuomar@dtgsa.com",
    },
    {
        id: "2",
        type: "enforce_permissions",
        typeName: "Permission Enforcement",
        status: "completed",
        progress: 100,
        completedTasks: 32,
        totalTasks: 32,
        startedAt: "2024-01-26T11:00:00Z",
        completedAt: "2024-01-26T11:05:00Z",
        startedBy: "system",
    },
    {
        id: "3",
        type: "template_sync_changes",
        typeName: "Template Changes Sync",
        status: "completed",
        progress: 100,
        completedTasks: 32,
        totalTasks: 32,
        startedAt: "2024-01-26T10:00:00Z",
        completedAt: "2024-01-26T10:02:00Z",
        startedBy: "mo.abuomar@dtgsa.com",
    },
    {
        id: "4",
        type: "build_folder_index",
        typeName: "Rebuild Folder Index",
        status: "failed",
        progress: 45,
        completedTasks: 14,
        totalTasks: 32,
        failedTasks: 1,
        startedAt: "2024-01-25T15:00:00Z",
        completedAt: "2024-01-25T15:10:00Z",
        errorSummary: "Rate limit exceeded on project PR-015",
        startedBy: "mo.abuomar@dtgsa.com",
    },
];

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

export default function JobsPage() {
    const [tab, setTab] = useState("all");

    const filteredJobs = jobs.filter((job) => {
        if (tab === "all") return true;
        return job.status === tab;
    });

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
                    <Button variant="outline">
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
                        <div className="text-2xl font-bold">1</div>
                        <p className="text-sm text-muted-foreground">Running</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-500">24</div>
                        <p className="text-sm text-muted-foreground">Completed Today</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-red-500">2</div>
                        <p className="text-sm text-muted-foreground">Failed This Week</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">~2min</div>
                        <p className="text-sm text-muted-foreground">Avg Duration</p>
                    </CardContent>
                </Card>
            </div>

            {/* Active Job Display */}
            {jobs.some((j) => j.status === "running") && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Active Job</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {jobs
                            .filter((j) => j.status === "running")
                            .map((job) => (
                                <div key={job.id} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium">{job.typeName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                Started by {job.startedBy}
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
                                                {job.completedTasks} / {job.totalTasks} projects
                                            </span>
                                        </div>
                                        <Progress value={job.progress} />
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
                                    <TableCell className="font-medium">{job.typeName}</TableCell>
                                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Progress value={job.progress} className="w-[60px]" />
                                            <span className="text-sm text-muted-foreground">
                                                {job.progress}%
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(job.startedAt).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {job.completedAt
                                            ? `${Math.round(
                                                (new Date(job.completedAt).getTime() -
                                                    new Date(job.startedAt).getTime()) /
                                                1000
                                            )}s`
                                            : "Running..."}
                                    </TableCell>
                                    <TableCell className="text-sm">{job.startedBy}</TableCell>
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
                </CardContent>
            </Card>
        </div>
    );
}
