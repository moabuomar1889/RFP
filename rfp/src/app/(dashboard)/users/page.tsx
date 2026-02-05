"use client";

import { useState, useEffect, useMemo } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Search,
    RefreshCw,
    Loader2,
    Eye,
    ChevronDown,
    ChevronRight,
    LayoutGrid,
    List,
    Users,
    UserPlus,
    X,
    FolderLock,
    Folder,
} from "lucide-react";
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
    groups?: string[];
}

interface Group {
    id: string;
    email: string;
    name: string;
    description?: string;
    member_count?: number;
}

interface FolderPermission {
    path: string;
    folderName: string;
    role: string | null;
    accessType: 'direct' | 'group' | 'public' | 'none';
    groupName?: string;
    depth: number;
}

type ViewMode = "table" | "grouped";
type GroupBy = "department" | "role" | "status";

export default function UsersPage() {
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const [groupBy, setGroupBy] = useState<GroupBy>("department");
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [savingGroups, setSavingGroups] = useState(false);
    const [selectedGroupsToAdd, setSelectedGroupsToAdd] = useState<Set<string>>(new Set());

    // Permissions modal state
    const [showPermissionsModal, setShowPermissionsModal] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [userPermissions, setUserPermissions] = useState<FolderPermission[]>([]);

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

    const fetchGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            if (data.success) {
                setGroups(data.groups || []);
            }
        } catch (error) {
            console.error('Error fetching groups:', error);
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
        fetchGroups();
    }, []);

    // Filter users
    const filteredUsers = users.filter(
        (user) =>
            user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Group users by selected criteria
    const groupedUsers = useMemo(() => {
        const grouped: Record<string, User[]> = {};

        filteredUsers.forEach((user) => {
            let key: string;
            switch (groupBy) {
                case "department":
                    key = user.department || "No Department";
                    break;
                case "role":
                    key = user.role || "User";
                    break;
                case "status":
                    key = user.status || "Active";
                    break;
                default:
                    key = "All";
            }

            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(user);
        });

        // Sort groups by name
        return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredUsers, groupBy]);

    const toggleGroup = (groupName: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(groupName)) {
                next.delete(groupName);
            } else {
                next.add(groupName);
            }
            return next;
        });
    };

    const expandAll = () => {
        setExpandedGroups(new Set(groupedUsers.map(([name]) => name)));
    };

    const collapseAll = () => {
        setExpandedGroups(new Set());
    };

    const handleAddToGroup = async (user: User, groupEmails: string[]) => {
        if (groupEmails.length === 0) {
            toast.error('Please select at least one group');
            return;
        }

        try {
            setSavingGroups(true);
            const res = await fetch(`/api/users/${user.id}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupEmails }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Added to ${groupEmails.length} group(s)`);
                setSelectedGroupsToAdd(new Set());
                setShowGroupModal(false);
                fetchUsers();
            } else {
                toast.error(data.error || 'Failed to add to group');
            }
        } catch (error) {
            toast.error('Failed to add to group');
        } finally {
            setSavingGroups(false);
        }
    };

    const handleRemoveFromGroup = async (user: User, groupEmail: string) => {
        try {
            setSavingGroups(true);
            const res = await fetch(`/api/users/${user.id}/groups?groupEmail=${encodeURIComponent(groupEmail)}`, {
                method: 'DELETE',
            });
            const data = await res.json();

            if (data.success) {
                toast.success(`Removed from group`);
                fetchUsers();
            } else {
                toast.error(data.error || 'Failed to remove from group');
            }
        } catch (error) {
            toast.error('Failed to remove from group');
        } finally {
            setSavingGroups(false);
        }
    };

    const fetchPermissions = async (user: User) => {
        try {
            setLoadingPermissions(true);
            setSelectedUser(user);
            setShowPermissionsModal(true);

            const res = await fetch(`/api/users/${user.id}/permissions`);
            const data = await res.json();

            if (data.success) {
                setUserPermissions(data.permissions || []);
            } else {
                toast.error(data.error || 'Failed to load permissions');
            }
        } catch (error) {
            console.error('Error fetching permissions:', error);
            toast.error('Failed to load folder permissions');
        } finally {
            setLoadingPermissions(false);
        }
    };

    const getRoleBadgeColor = (role: string | null, accessType: string) => {
        if (accessType === 'none') return 'bg-gray-100 text-gray-500';
        if (accessType === 'public') return 'bg-slate-100 text-slate-600';
        switch (role) {
            case 'organizer':
            case 'fileOrganizer':
                return 'bg-green-100 text-green-700';
            case 'writer':
                return 'bg-blue-100 text-blue-700';
            case 'commenter':
            case 'reader':
                return 'bg-yellow-100 text-yellow-700';
            default:
                return 'bg-gray-100 text-gray-500';
        }
    };

    const getRoleLabel = (role: string | null, accessType: string) => {
        if (accessType === 'none') return 'No Access';
        if (accessType === 'public') return 'Public';
        switch (role) {
            case 'organizer': return 'Organizer';
            case 'fileOrganizer': return 'File Organizer';
            case 'writer': return 'Writer';
            case 'commenter': return 'Commenter';
            case 'reader': return 'Reader';
            default: return role || 'Unknown';
        }
    };

    const getInitials = (name: string) => {
        return name
            ?.split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase() || "?";
    };

    const getGroupColor = (groupName: string) => {
        const colors = [
            "bg-orange-500",
            "bg-blue-500",
            "bg-green-500",
            "bg-purple-500",
            "bg-pink-500",
            "bg-yellow-500",
            "bg-cyan-500",
            "bg-red-500",
        ];
        const index = groupName.length % colors.length;
        return colors[index];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    // Count stats for grouped view
    const totalGroups = groupedUsers.length;

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Users</h1>
                    <p className="text-muted-foreground">
                        Showing {filteredUsers.length} of {users.length} users in {totalGroups} groups
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

            {/* Search and Filters */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-4 items-center">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users by name, email, or department..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Group By */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Group by:</span>
                            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="department">Department</SelectItem>
                                    <SelectItem value="role">Role</SelectItem>
                                    <SelectItem value="status">Status</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* View Toggle */}
                        <div className="flex border rounded-md">
                            <Button
                                variant={viewMode === "grouped" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("grouped")}
                                className="rounded-r-none"
                            >
                                <LayoutGrid className="h-4 w-4 mr-1" />
                                Grouped
                            </Button>
                            <Button
                                variant={viewMode === "table" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("table")}
                                className="rounded-l-none"
                            >
                                <List className="h-4 w-4 mr-1" />
                                Table
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Content */}
            {viewMode === "grouped" ? (
                /* Grouped View */
                <div className="space-y-3">
                    {/* Expand/Collapse All */}
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={expandAll}>
                            Expand All
                        </Button>
                        <Button variant="outline" size="sm" onClick={collapseAll}>
                            Collapse All
                        </Button>
                    </div>

                    {groupedUsers.map(([groupName, groupUsers]) => (
                        <Card key={groupName} className="overflow-hidden">
                            {/* Group Header */}
                            <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => toggleGroup(groupName)}
                            >
                                <div className="flex items-center gap-3">
                                    {expandedGroups.has(groupName) ? (
                                        <ChevronDown className="h-5 w-5" />
                                    ) : (
                                        <ChevronRight className="h-5 w-5" />
                                    )}
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${getGroupColor(groupName)}`}
                                    >
                                        {groupName[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">{groupName}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {groupUsers.length} {groupUsers.length === 1 ? "user" : "users"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant="secondary">
                                        Active: {groupUsers.filter((u) => u.status === "Active").length}
                                    </Badge>
                                    <Badge variant="outline">
                                        Admin: {groupUsers.filter((u) => u.role === "Admin").length}
                                    </Badge>
                                </div>
                            </div>

                            {/* Group Content */}
                            {expandedGroups.has(groupName) && (
                                <div className="border-t">
                                    <Table>
                                        <TableBody>
                                            {groupUsers.map((user) => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarFallback>
                                                                    {getInitials(user.name)}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <p className="font-medium">{user.name || "Unknown"}</p>
                                                                <p className="text-sm text-muted-foreground">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1">
                                                            {user.groups && user.groups.length > 0 ? (
                                                                user.groups.map((g) => (
                                                                    <Badge key={g} variant="outline" className="text-xs">
                                                                        {g}
                                                                    </Badge>
                                                                ))
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">No groups</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                                                            {user.role || "User"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant="outline"
                                                            className={user.status === "Active" ? "text-green-500 border-green-500" : ""}
                                                        >
                                                            {user.status || "Active"}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedUser(user);
                                                                    setSelectedGroupsToAdd(new Set());
                                                                    setShowGroupModal(true);
                                                                }}
                                                            >
                                                                <Users className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    fetchPermissions(user);
                                                                }}
                                                                title="View folder permissions"
                                                            >
                                                                <FolderLock className="h-4 w-4" />
                                                            </Button>
                                                            <Link href={`/users/${user.id}`}>
                                                                <Button variant="ghost" size="sm">
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            ) : (
                /* Table View */
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
                                    <TableHead>Groups</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[120px]">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarFallback>
                                                        {getInitials(user.name)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-medium">{user.name || "Unknown"}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {user.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.department || "-"}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                {user.groups && user.groups.length > 0 ? (
                                                    <>
                                                        {user.groups.slice(0, 2).map((g) => (
                                                            <Badge key={g} variant="outline" className="text-xs">
                                                                {g}
                                                            </Badge>
                                                        ))}
                                                        {user.groups.length > 2 && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                +{user.groups.length - 2}
                                                            </Badge>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-muted-foreground text-sm">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                                                {user.role || "User"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={user.status === "Active" ? "text-green-500 border-green-500" : ""}
                                            >
                                                {user.status || "Active"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setSelectedGroupsToAdd(new Set());
                                                        setShowGroupModal(true);
                                                    }}
                                                    title="Manage groups"
                                                >
                                                    <Users className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => fetchPermissions(user)}
                                                    title="View folder permissions"
                                                >
                                                    <FolderLock className="h-4 w-4" />
                                                </Button>
                                                <Link href={`/users/${user.id}`}>
                                                    <Button variant="ghost" size="sm" title="View details">
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>
            )}

            {/* Group Management Modal */}
            <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Manage Groups - {selectedUser?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Add or remove group memberships for this user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* Current Groups */}
                        <div>
                            <h4 className="text-sm font-medium mb-2">Current Groups</h4>
                            <div className="flex flex-wrap gap-2">
                                {selectedUser?.groups && selectedUser.groups.length > 0 ? (
                                    selectedUser.groups.map((groupName) => {
                                        const group = groups.find((g) => g.name === groupName);
                                        return (
                                            <Badge
                                                key={groupName}
                                                variant="secondary"
                                                className="flex items-center gap-1"
                                            >
                                                {groupName}
                                                <button
                                                    onClick={() => {
                                                        if (group && selectedUser) {
                                                            handleRemoveFromGroup(selectedUser, group.email);
                                                        }
                                                    }}
                                                    disabled={savingGroups}
                                                    className="ml-1 hover:text-destructive"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </Badge>
                                        );
                                    })
                                ) : (
                                    <span className="text-muted-foreground text-sm">
                                        Not in any groups
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Add to Groups - Multi-select with checkboxes */}
                        <div>
                            <h4 className="text-sm font-medium mb-2">
                                Add to Groups
                                {selectedGroupsToAdd.size > 0 && (
                                    <span className="ml-2 text-primary">({selectedGroupsToAdd.size} selected)</span>
                                )}
                            </h4>
                            <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1">
                                {groups
                                    .filter((g) => !selectedUser?.groups?.includes(g.name))
                                    .map((group) => (
                                        <label
                                            key={group.id}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${selectedGroupsToAdd.has(group.email)
                                                ? 'bg-primary/10 border border-primary/30'
                                                : 'hover:bg-muted'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300"
                                                checked={selectedGroupsToAdd.has(group.email)}
                                                onChange={(e) => {
                                                    const newSet = new Set(selectedGroupsToAdd);
                                                    if (e.target.checked) {
                                                        newSet.add(group.email);
                                                    } else {
                                                        newSet.delete(group.email);
                                                    }
                                                    setSelectedGroupsToAdd(newSet);
                                                }}
                                                disabled={savingGroups}
                                            />
                                            <span className="text-sm">{group.name}</span>
                                            {group.member_count !== undefined && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({group.member_count} members)
                                                </span>
                                            )}
                                        </label>
                                    ))}
                                {groups.filter((g) => !selectedUser?.groups?.includes(g.name)).length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-2">
                                        User is already in all available groups
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Apply Button */}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedGroupsToAdd(new Set());
                                    setShowGroupModal(false);
                                }}
                                disabled={savingGroups}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => {
                                    if (selectedUser && selectedGroupsToAdd.size > 0) {
                                        handleAddToGroup(selectedUser, Array.from(selectedGroupsToAdd));
                                    }
                                }}
                                disabled={savingGroups || selectedGroupsToAdd.size === 0}
                            >
                                {savingGroups ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    `Apply (${selectedGroupsToAdd.size})`
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Permissions Modal */}
            <Dialog open={showPermissionsModal} onOpenChange={setShowPermissionsModal}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderLock className="h-5 w-5" />
                            Folder Permissions for {selectedUser?.name}
                        </DialogTitle>
                        <DialogDescription>
                            View folder access based on group memberships and template settings.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="mb-3">
                            <p className="text-sm text-muted-foreground">
                                {selectedUser.email}
                            </p>
                            {selectedUser.groups && selectedUser.groups.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                    <span className="text-sm font-medium">Groups:</span>
                                    {selectedUser.groups.map((group) => (
                                        <Badge key={group} variant="outline">{group}</Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex gap-2 text-xs mb-2">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-green-100"></span> Organizer
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-blue-100"></span> Writer
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-yellow-100"></span> Reader
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-slate-100"></span> Public
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-gray-100"></span> No Access
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto border rounded-md p-3">
                        {loadingPermissions ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                Loading permissions...
                            </div>
                        ) : userPermissions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No folder permissions found
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {userPermissions.map((perm, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50"
                                        style={{ paddingLeft: `${perm.depth * 20 + 8}px` }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4 text-muted-foreground" />
                                            <span className={perm.accessType === 'none' ? 'text-muted-foreground' : ''}>
                                                {perm.folderName}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {perm.groupName && perm.accessType === 'group' && (
                                                <span className="text-xs text-muted-foreground">
                                                    via {perm.groupName}
                                                </span>
                                            )}
                                            {perm.accessType === 'direct' && (
                                                <span className="text-xs text-muted-foreground">
                                                    direct
                                                </span>
                                            )}
                                            <Badge
                                                variant="secondary"
                                                className={`text-xs ${getRoleBadgeColor(perm.role, perm.accessType)}`}
                                            >
                                                {getRoleLabel(perm.role, perm.accessType)}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end pt-3">
                        <Button variant="outline" onClick={() => setShowPermissionsModal(false)}>
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
