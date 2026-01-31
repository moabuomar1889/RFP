"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Search,
    RefreshCw,
    Download,
    FileStack,
    Shield,
    FolderKanban,
    Settings,
    User,
    Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface AuditLog {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: any;
    performed_by: string | null;
    created_at: string;
}

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
    if (action.includes("revert") || action.includes("error")) return <Badge variant="destructive">{action}</Badge>;
    if (action.includes("created") || action.includes("completed")) return <Badge className="bg-green-500">{action}</Badge>;
    if (action.includes("updated") || action.includes("applied")) return <Badge className="bg-blue-500">{action}</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
}

export default function AuditPage() {
    const [loading, setLoading] = useState(true);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [tab, setTab] = useState("all");

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/audit?limit=100');
            const data = await res.json();

            if (data.success && Array.isArray(data.logs)) {
                setAuditLogs(data.logs);
            } else {
                setAuditLogs([]);
            }
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            toast.error('Failed to load audit logs');
            setAuditLogs([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = auditLogs.filter((log) => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.entity_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.performed_by || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesTab =
            tab === "all" ||
            (tab === "permissions" && log.entity_type === "folder") ||
            (tab === "template" && log.entity_type === "template") ||
            (tab === "projects" && log.entity_type === "project");
        return matchesSearch && matchesTab;
    });

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
                    <h1 className="text-3xl font-bold tracking-tight">Audit Log</h1>
                    <p className="text-muted-foreground">
                        Track all system actions and changes
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchLogs}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
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
                        {filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                    No audit logs found
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>{getActionBadge(log.action)}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {getActionIcon(log.entity_type)}
                                            <div>
                                                <p className="text-sm font-medium">{log.entity_type}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {log.entity_id || '-'}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[300px]">
                                        <p className="text-sm text-muted-foreground truncate">
                                            {log.details ? JSON.stringify(log.details).slice(0, 100) : '-'}
                                        </p>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {log.performed_by === "system" ? (
                                            <Badge variant="outline">System</Badge>
                                        ) : (
                                            log.performed_by || '-'
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
