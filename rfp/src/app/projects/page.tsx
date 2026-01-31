"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    Plus,
    Search,
    RefreshCw,
    MoreHorizontal,
    FolderOpen,
    CheckCircle2,
    AlertTriangle,
    Clock,
} from "lucide-react";
import Link from "next/link";

// Mock data - would come from API
const projects = [
    {
        id: "1",
        prNumber: "PR-001",
        name: "Al Madinah Tower",
        status: "execution",
        syncedVersion: 12,
        lastSynced: "2024-01-26T10:00:00Z",
        lastEnforced: "2024-01-26T11:00:00Z",
        foldersCount: 52,
        hasViolations: false,
    },
    {
        id: "2",
        prNumber: "PR-002",
        name: "Riyadh Commercial Center",
        status: "bidding",
        syncedVersion: 12,
        lastSynced: "2024-01-26T10:00:00Z",
        lastEnforced: "2024-01-26T11:00:00Z",
        foldersCount: 18,
        hasViolations: true,
    },
    {
        id: "3",
        prNumber: "PR-003",
        name: "Jeddah Mall Extension",
        status: "execution",
        syncedVersion: 11,
        lastSynced: "2024-01-25T10:00:00Z",
        lastEnforced: "2024-01-25T11:00:00Z",
        foldersCount: 48,
        hasViolations: false,
    },
];

export default function ProjectsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState("all");

    const filteredProjects = projects.filter((project) => {
        const matchesSearch =
            project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.prNumber.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
            tab === "all" || project.status === tab;
        return matchesSearch && matchesTab;
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                    <p className="text-muted-foreground">
                        Manage your Google Drive project folders
                    </p>
                </div>
                <Button asChild>
                    <Link href="/projects/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Project
                    </Link>
                </Button>
            </div>

            {/* Filters and Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search projects..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList>
                                <TabsTrigger value="all">All ({projects.length})</TabsTrigger>
                                <TabsTrigger value="bidding">
                                    Bidding ({projects.filter((p) => p.status === "bidding").length})
                                </TabsTrigger>
                                <TabsTrigger value="execution">
                                    Execution ({projects.filter((p) => p.status === "execution").length})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Button variant="outline" size="icon">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Projects Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Project</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Folders</TableHead>
                            <TableHead>Sync Version</TableHead>
                            <TableHead>Last Synced</TableHead>
                            <TableHead>Permissions</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredProjects.map((project) => (
                            <TableRow key={project.id}>
                                <TableCell>
                                    <Link
                                        href={`/projects/${project.id}`}
                                        className="flex items-center gap-3 hover:underline"
                                    >
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <FolderOpen className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{project.prNumber}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {project.name}
                                            </p>
                                        </div>
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <Badge
                                        variant={
                                            project.status === "execution" ? "default" : "secondary"
                                        }
                                    >
                                        {project.status === "execution" ? "Execution" : "Bidding"}
                                    </Badge>
                                </TableCell>
                                <TableCell>{project.foldersCount}</TableCell>
                                <TableCell>
                                    <Badge variant="outline">v{project.syncedVersion}</Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {new Date(project.lastSynced).toLocaleDateString()}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {project.hasViolations ? (
                                        <div className="flex items-center gap-1 text-amber-500">
                                            <AlertTriangle className="h-4 w-4" />
                                            <span className="text-sm">Violation</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-green-500">
                                            <CheckCircle2 className="h-4 w-4" />
                                            <span className="text-sm">OK</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
