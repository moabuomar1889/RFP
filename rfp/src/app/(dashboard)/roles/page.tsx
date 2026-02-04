"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Shield, Users, User, Trash2, Pencil, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Role {
    id: string;
    role_name: string;
    description?: string;
    drive_role: string;
    is_system?: boolean;
    principals?: Array<{ type: string; email: string }>;
    created_at?: string;
}

function getDriveRoleBadge(role: string) {
    const colors: Record<string, string> = {
        organizer: "bg-red-500",
        fileOrganizer: "bg-orange-500",
        writer: "bg-blue-500",
        commenter: "bg-cyan-500",
        reader: "bg-gray-500",
    };
    return (
        <Badge className={colors[role] || "bg-gray-500"}>
            {role}
        </Badge>
    );
}

export default function RolesPage() {
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [creating, setCreating] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', description: '', driveRole: 'writer' });

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/roles');
            const data = await res.json();

            if (data.success) {
                setRoles(data.roles || []);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
            toast.error('Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRole = async () => {
        if (!newRole.name || !newRole.driveRole) {
            toast.error('Role name and drive role are required');
            return;
        }

        try {
            setCreating(true);
            const res = await fetch('/api/roles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roleName: newRole.name,
                    description: newRole.description,
                    driveRole: newRole.driveRole,
                }),
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Role created successfully');
                setDialogOpen(false);
                setNewRole({ name: '', description: '', driveRole: 'writer' });
                fetchRoles();
            } else {
                toast.error(data.error || 'Failed to create role');
            }
        } catch (error) {
            toast.error('Failed to create role');
        } finally {
            setCreating(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

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
                    <h1 className="text-3xl font-bold tracking-tight">Roles</h1>
                    <p className="text-muted-foreground">
                        Permission Directory - map roles to groups and users
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchRoles}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="mr-2 h-4 w-4" />
                                New Role
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create New Role</DialogTitle>
                                <DialogDescription>
                                    Define a new permission role for the template
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Role Name</Label>
                                    <Input
                                        placeholder="e.g., SAFETY_TEAM"
                                        value={newRole.name}
                                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Description</Label>
                                    <Input
                                        placeholder="e.g., Health and safety team access"
                                        value={newRole.description}
                                        onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Drive Role</Label>
                                    <select
                                        className="w-full p-2 rounded-md border"
                                        value={newRole.driveRole}
                                        onChange={(e) => setNewRole({ ...newRole, driveRole: e.target.value })}
                                    >
                                        <option value="writer">Writer (Edit)</option>
                                        <option value="reader">Reader (View only)</option>
                                        <option value="fileOrganizer">File Organizer</option>
                                        <option value="commenter">Commenter</option>
                                        <option value="organizer">Organizer (Full)</option>
                                    </select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateRole} disabled={creating}>
                                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Create Role
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Roles Grid */}
            {roles.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <p className="mb-4">No roles defined yet.</p>
                        <Button onClick={() => setDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create Your First Role
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {roles.map((role) => (
                        <Card
                            key={role.id}
                            className={`cursor-pointer hover:border-primary/50 transition-colors ${selectedRole?.id === role.id ? "border-primary" : ""
                                }`}
                            onClick={() => setSelectedRole(role)}
                        >
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-5 w-5 text-primary" />
                                        <CardTitle className="text-lg">{role.role_name}</CardTitle>
                                    </div>
                                    {role.is_system && (
                                        <Badge variant="secondary" className="text-xs">
                                            System
                                        </Badge>
                                    )}
                                </div>
                                <CardDescription>{role.description || 'No description'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {getDriveRoleBadge(role.drive_role)}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        {(role.principals || []).length} principal(s)
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Selected Role Details */}
            {selectedRole && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{selectedRole.role_name}</CardTitle>
                                <CardDescription>{selectedRole.description}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                {!selectedRole.is_system && (
                                    <Button variant="outline" size="sm">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium">Drive Role:</span>
                            {getDriveRoleBadge(selectedRole.drive_role)}
                        </div>

                        <Separator />

                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium">Assigned Principals</h4>
                                <Button variant="outline" size="sm">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Principal
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {(selectedRole.principals || []).map((principal, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-3 rounded-lg border"
                                    >
                                        <div className="flex items-center gap-3">
                                            {principal.type === "group" ? (
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <User className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="text-sm">{principal.email}</span>
                                            <Badge variant="outline" className="text-xs">
                                                {principal.type}
                                            </Badge>
                                        </div>
                                        <Button variant="ghost" size="sm">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                {(selectedRole.principals || []).length === 0 && (
                                    <p className="text-sm text-muted-foreground py-4 text-center">
                                        No principals assigned to this role
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
