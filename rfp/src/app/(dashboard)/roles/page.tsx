"use client";

import { useState } from "react";
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
import { Plus, Shield, Users, User, Trash2, Pencil } from "lucide-react";

// Mock roles data
const roles = [
    {
        id: "1",
        name: "ADMIN",
        description: "Full administrative access",
        driveRole: "organizer",
        isSystem: true,
        principals: [
            { type: "user", email: "mo.abuomar@dtgsa.com" },
            { type: "group", email: "admins@dtgsa.com" },
        ],
    },
    {
        id: "2",
        name: "PROJECT_MANAGER",
        description: "Project manager access",
        driveRole: "fileOrganizer",
        isSystem: false,
        principals: [{ type: "group", email: "project-managers@dtgsa.com" }],
    },
    {
        id: "3",
        name: "QUANTITY_SURVEYOR",
        description: "Quantity surveyor access",
        driveRole: "writer",
        isSystem: false,
        principals: [{ type: "group", email: "qs-team@dtgsa.com" }],
    },
    {
        id: "4",
        name: "TECHNICAL_TEAM",
        description: "Technical team access",
        driveRole: "writer",
        isSystem: false,
        principals: [{ type: "group", email: "technical@dtgsa.com" }],
    },
    {
        id: "5",
        name: "EXECUTION_TEAM",
        description: "Execution team access",
        driveRole: "writer",
        isSystem: false,
        principals: [{ type: "group", email: "execution@dtgsa.com" }],
    },
    {
        id: "6",
        name: "VIEWER",
        description: "Read-only access",
        driveRole: "reader",
        isSystem: false,
        principals: [],
    },
];

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
    const [selectedRole, setSelectedRole] = useState<any>(null);

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
                <Dialog>
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
                                <Input placeholder="e.g., SAFETY_TEAM" />
                            </div>
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input placeholder="e.g., Health and safety team access" />
                            </div>
                            <div className="space-y-2">
                                <Label>Drive Role</Label>
                                <select className="w-full p-2 rounded-md border">
                                    <option value="writer">Writer (Edit)</option>
                                    <option value="reader">Reader (View only)</option>
                                    <option value="fileOrganizer">File Organizer</option>
                                    <option value="commenter">Commenter</option>
                                </select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button>Create Role</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Roles Grid */}
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
                                    <CardTitle className="text-lg">{role.name}</CardTitle>
                                </div>
                                {role.isSystem && (
                                    <Badge variant="secondary" className="text-xs">
                                        System
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>{role.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {getDriveRoleBadge(role.driveRole)}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {role.principals.length} principal(s)
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Selected Role Details */}
            {selectedRole && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>{selectedRole.name}</CardTitle>
                                <CardDescription>{selectedRole.description}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </Button>
                                {!selectedRole.isSystem && (
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
                            {getDriveRoleBadge(selectedRole.driveRole)}
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
                                {selectedRole.principals.map((principal: any, i: number) => (
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
                                {selectedRole.principals.length === 0 && (
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
