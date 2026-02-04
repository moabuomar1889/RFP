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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, RefreshCw, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface User {
    id: string;
    email: string;
    name: string;
    role?: string;
    department?: string;
    status?: string;
    last_login?: string;
    created_at?: string;
}

export default function UsersPage() {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/users');
            const data = await res.json();

            if (data.success) {
                setUsers(data.users || []);
            } else {
                toast.error(data.error || 'Failed to load users');
            }
        } catch (error) {
            console.error('Error fetching users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            const res = await fetch('/api/users', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                toast.success('Users synced successfully');
                fetchUsers();
            } else {
                toast.error(data.error || 'Sync not available');
            }
        } catch (error) {
            toast.error('Failed to sync users');
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const filteredUsers = users.filter(
        (user) =>
            user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase())
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
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">
                        {users.length} users in your organization
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchUsers}>
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
                            placeholder="Search users by name or email..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                {filteredUsers.length === 0 ? (
                    <CardContent className="py-12 text-center text-muted-foreground">
                        {users.length === 0 ? (
                            <div>
                                <p className="mb-4">No users found in the database.</p>
                                <Button onClick={handleSync} disabled={syncing}>
                                    Sync Users from Google Workspace
                                </Button>
                            </div>
                        ) : (
                            <p>No users match your search.</p>
                        )}
                    </CardContent>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Department</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="w-[100px]">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>
                                                    {user.name
                                                        ?.split(" ")
                                                        .map((n) => n[0])
                                                        .join("") || "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium">{user.name || 'Unknown'}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{user.department || '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                                            {user.role || 'User'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className="text-green-500 border-green-500"
                                        >
                                            {user.status || 'Active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Link href={`/users/${user.id}`}>
                                            <Button variant="ghost" size="sm">
                                                <Eye className="h-4 w-4 mr-1" />
                                                View
                                            </Button>
                                        </Link>
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
