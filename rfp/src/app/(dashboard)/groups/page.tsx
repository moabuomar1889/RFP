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
import { Search, RefreshCw, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Group {
    id: string;
    email: string;
    name: string;
    description?: string;
    member_count?: number;
    mapped_role?: string;
    created_at?: string;
}

export default function GroupsPage() {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [groups, setGroups] = useState<Group[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/groups');
            const data = await res.json();

            if (data.success) {
                setGroups(data.groups || []);
            } else {
                toast.error(data.error || 'Failed to load groups');
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            const res = await fetch('/api/groups', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                toast.success('Groups synced successfully');
                fetchGroups();
            } else {
                toast.error(data.error || 'Sync not available');
            }
        } catch (error) {
            toast.error('Failed to sync groups');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchGroups();
    }, []);

    const filteredGroups = groups.filter(
        (group) =>
            group.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                    <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
                    <p className="text-muted-foreground">
                        {groups.length} groups for permission assignment
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchGroups}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button onClick={handleSync} disabled={syncing}>
                        {syncing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Sync from Google
                    </Button>
                </div>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search groups by name or email..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Groups Table */}
            <Card>
                {filteredGroups.length === 0 ? (
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {groups.length === 0 ? (
                            <div>
                                <p className="mb-4">No groups found in the database.</p>
                                <Button onClick={handleSync} disabled={syncing}>
                                    Sync Groups from Google Workspace
                                </Button>
                            </div>
                        ) : (
                            <p>No groups match your search.</p>
                        )}
                    </CardContent>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Group</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Members</TableHead>
                                <TableHead>Mapped Role</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredGroups.map((group) => (
                                <TableRow key={group.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                                <Users className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{group.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {group.email}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {group.description || '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {group.member_count || 0} members
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {group.mapped_role ? (
                                            <Badge>{group.mapped_role}</Badge>
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                Not mapped
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </div>
    );
}
