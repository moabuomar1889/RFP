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
import { Search, RefreshCw, Users, MoreHorizontal } from "lucide-react";

// Mock groups data from Admin SDK
const groups = [
    {
        id: "1",
        email: "admins@dtgsa.com",
        name: "Admins",
        description: "System administrators",
        memberCount: 3,
        mappedRole: "ADMIN",
    },
    {
        id: "2",
        email: "project-managers@dtgsa.com",
        name: "Project Managers",
        description: "All project managers",
        memberCount: 8,
        mappedRole: "PROJECT_MANAGER",
    },
    {
        id: "3",
        email: "qs-team@dtgsa.com",
        name: "Quantity Surveyors",
        description: "QS department team",
        memberCount: 12,
        mappedRole: "QUANTITY_SURVEYOR",
    },
    {
        id: "4",
        email: "technical@dtgsa.com",
        name: "Technical Team",
        description: "Engineering and technical staff",
        memberCount: 25,
        mappedRole: "TECHNICAL_TEAM",
    },
    {
        id: "5",
        email: "execution@dtgsa.com",
        name: "Execution Team",
        description: "Site execution team",
        memberCount: 40,
        mappedRole: "EXECUTION_TEAM",
    },
    {
        id: "6",
        email: "all-staff@dtgsa.com",
        name: "All Staff",
        description: "All company employees",
        memberCount: 150,
        mappedRole: null,
    },
];

export default function GroupsPage() {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredGroups = groups.filter(
        (group) =>
            group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            group.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
                    <p className="text-muted-foreground">
                        Google Workspace groups for permission assignment
                    </p>
                </div>
                <Button variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync from Google
                </Button>
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
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Group</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Members</TableHead>
                            <TableHead>Mapped Role</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
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
                                    {group.description}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline">{group.memberCount} members</Badge>
                                </TableCell>
                                <TableCell>
                                    {group.mappedRole ? (
                                        <Badge>{group.mappedRole}</Badge>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">
                                            Not mapped
                                        </span>
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
