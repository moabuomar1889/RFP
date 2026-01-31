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
    Search,
    RefreshCw,
    Download,
    Filter,
    FileStack,
    Shield,
    FolderKanban,
    Settings,
    User,
} from "lucide-react";

// Mock audit log data
const auditLogs = [
    {
        id: "1",
        action: "permission_reverted",
        entityType: "folder",
        entityId: "PRJ-PR-015/RFP/Technical",
        details: {
            violation: "Unauthorized user added",
            reverted_email: "external@gmail.com",
        },
        performedBy: "system",
        createdAt: "2024-01-26T12:05:00Z",
    },
    {
        id: "2",
        action: "template_updated",
        entityType: "template",
        entityId: "v12",
        details: {
            changes: ["Added Safety Documents folder", "Updated Technical permissions"],
        },
        performedBy: "mo.abuomar@dtgsa.com",
        createdAt: "2024-01-26T10:00:00Z",
    },
    {
        id: "3",
        action: "template_applied",
        entityType: "job",
        entityId: "job-123",
        details: {
            template_version: 12,
            projects_synced: 32,
        },
        performedBy: "mo.abuomar@dtgsa.com",
        createdAt: "2024-01-26T10:02:00Z",
    },
    {
        id: "4",
        action: "project_created",
        entityType: "project",
        entityId: "PR-033",
        details: {
            name: "New Mall Project",
            template_version: 12,
        },
        performedBy: "mo.abuomar@dtgsa.com",
        createdAt: "2024-01-25T14:00:00Z",
    },
    {
        id: "5",
        action: "role_updated",
        entityType: "role",
        entityId: "QUANTITY_SURVEYOR",
        details: {
            added_principal: "new-qs@dtgsa.com",
        },
        performedBy: "mo.abuomar@dtgsa.com",
        createdAt: "2024-01-25T11:00:00Z",
    },
    {
        id: "6",
        action: "user_login",
        entityType: "user",
        entityId: "mo.abuomar@dtgsa.com",
        details: {
            ip: "192.168.1.1",
        },
        performedBy: "mo.abuomar@dtgsa.com",
        createdAt: "2024-01-26T08:00:00Z",
    },
];

function getActionIcon(entityType: string) {
    switch (entityType) {
        case "template":
            return <FileStack className="h-4 w-4" />;
        case "folder":
            return <Shield className="h-4 w-4" />;
        case "project":
            return <FolderKanban className="h-4 w-4" />;
        case "role":
            return <Settings className="h-4 w-4" />;
        case "user":
            return <User className="h-4 w-4" />;
        default:
            return <Settings className="h-4 w-4" />;
    }
}

function getActionBadge(action: string) {
    if (action.includes("revert")) return <Badge variant="destructive">{action}</Badge>;
    if (action.includes("created")) return <Badge className="bg-green-500">{action}</Badge>;
    if (action.includes("updated") || action.includes("applied")) return <Badge className="bg-blue-500">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
}

export default function AuditPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState("all");

    const filteredLogs = auditLogs.filter((log) => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.performedBy.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
            tab === "all" ||
            (tab === "permissions" && log.entityType === "folder") ||
            (tab === "template" && log.entityType === "template") ||
            (tab === "projects" && log.entityType === "project");
        return matchesSearch && matchesTab;
    });

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-muted-foreground">
                        Track all system actions and changes
                    </p>
                </div>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search actions, entities, users..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Tabs value={tab} onValueChange={setTab}>
                            <TabsList>
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="permissions">Permissions</TabsTrigger>
                                <TabsTrigger value="template">Template</TabsTrigger>
                                <TabsTrigger value="projects">Projects</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </CardContent>
            </Card>

            {/* Audit Log Table */}
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Action</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Performed By</TableHead>
                            <TableHead>Time</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLogs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{getActionBadge(log.action)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {getActionIcon(log.entityType)}
                                        <div>
                                            <p className="text-sm font-medium">{log.entityType}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {log.entityId}
                                            </p>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="max-w-[300px]">
                                    <p className="text-sm text-muted-foreground truncate">
                                        {JSON.stringify(log.details).slice(0, 100)}...
                                    </p>
                                </TableCell>
                                <TableCell className="text-sm">
                                    {log.performedBy === "system" ? (
                                        <Badge variant="outline">System</Badge>
                                    ) : (
                                        log.performedBy
                                    )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {new Date(log.createdAt).toLocaleString()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
