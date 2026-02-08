"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Folder,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Lock,
    Shield,
    Users,
    User,
    X,
    Plus,
    Info,
    AlertTriangle,
    Check,
    Loader2,
    Download,
    History,
    Play,
    Undo2,
    Ban,
    ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import type {
    FolderNode,
    TemplateTreeState,
    RawTemplateNode,
    EffectivePrincipal,
    DriveRole,
} from "@/lib/template-engine/types";
import {
    deserializeTemplate,
    serializeTemplate,
    toggleLimitedAccess,
    clearLimitedAccess,
    addPrincipal,
    removePrincipal,
    addOverrideRemove,
    removeOverrideRemove,
    setOverrideDowngrade,
    removeOverrideDowngrade,
    hasActiveOverrides,
    ROLE_RANK,
} from "@/lib/template-engine";

// ─── Auto-Save Constants ────────────────────────────────────
const AUTO_SAVE_DEBOUNCE_MS = 1000;

// ─── Folder Tree Node Component ─────────────────────────────
function TreeNode({
    nodeId,
    state,
    selectedId,
    expandedIds,
    onSelect,
    onToggleExpand,
    level = 0,
}: {
    nodeId: string;
    state: TemplateTreeState;
    selectedId: string | null;
    expandedIds: Set<string>;
    onSelect: (id: string) => void;
    onToggleExpand: (id: string) => void;
    level?: number;
}) {
    const node = state.nodes[nodeId];
    if (!node) return null;

    const isSelected = selectedId === nodeId;
    const isExpanded = expandedIds.has(nodeId);
    const hasChildren = node.childrenIds.length > 0;
    const isLimited = node.effectivePolicy.limitedAccess;

    return (
        <div>
            <div
                className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer text-sm transition-colors ${isSelected
                    ? "bg-primary/10 text-primary font-medium"
                    : "hover:bg-muted/50"
                    }`}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
                onClick={() => onSelect(nodeId)}
            >
                {hasChildren ? (
                    <button
                        className="p-0.5 hover:bg-muted rounded"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleExpand(nodeId);
                        }}
                    >
                        {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                        )}
                    </button>
                ) : (
                    <span className="w-5" />
                )}
                {isExpanded ? (
                    <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
                ) : (
                    <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
                )}
                <span className="truncate">{node.name}</span>
                {isLimited && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 ml-auto" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-[250px]">
                                <p className="font-semibold text-xs">Locked by Restrictive Tree</p>
                                <p className="text-xs text-muted-foreground">This folder or its parent enforces Limited Access</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            {isExpanded &&
                node.childrenIds.map((childId) => (
                    <TreeNode
                        key={childId}
                        nodeId={childId}
                        state={state}
                        selectedId={selectedId}
                        expandedIds={expandedIds}
                        onSelect={onSelect}
                        onToggleExpand={onToggleExpand}
                        level={level + 1}
                    />
                ))}
        </div>
    );
}

// ─── Table A: Effective Policy (Read-Only) ──────────────────
function EffectivePolicyTable({ node, state }: { node: FolderNode; state: TemplateTreeState }) {
    const { derivedPolicy, effectivePolicy } = node;

    const getSourceLabel = (source: string, fromId: string | null) => {
        if (source === "explicit") return "Explicit";
        if (source === "system-default") return "System Default";
        if (source === "override-required") return "Required by Overrides";
        if (source === "inherited" && fromId) {
            const sourceNode = state.nodes[fromId];
            return `Inherited from "${sourceNode?.name || fromId}"`;
        }
        return "Inherited";
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-sm">Effective Policy</h3>
                <Badge variant="secondary" className="text-xs">Read-Only</Badge>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Property</TableHead>
                        <TableHead className="w-[150px]">Value</TableHead>
                        <TableHead>Source</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    <TableRow>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <Lock className="h-3.5 w-3.5 text-amber-500" />
                                Limited Access
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                {effectivePolicy.limitedAccess ? (
                                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                                        ✓ Enabled
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        ✗ Disabled
                                    </Badge>
                                )}
                                {effectivePolicy.limitedAccess && derivedPolicy.limitedAccessSource === "inherited" && (
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="max-w-[250px]">
                                                <p className="font-semibold text-xs">Locked by Restrictive Tree</p>
                                                <p className="text-xs text-muted-foreground">This folder or its parent enforces Limited Access</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                )}
                            </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                            {getSourceLabel(
                                derivedPolicy.limitedAccessSource,
                                derivedPolicy.limitedAccessInheritedFrom
                            )}
                        </TableCell>
                    </TableRow>
                    {effectivePolicy.principals.filter(p => p.overrideAction !== 'removed').map((p, i) => (
                        <TableRow key={`${p.email}-${i}`} className={p.overrideAction === 'downgraded' ? 'bg-orange-500/5' : ''}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {p.type === "group" ? (
                                        <Users className="h-3.5 w-3.5 text-blue-500" />
                                    ) : (
                                        <User className="h-3.5 w-3.5 text-green-500" />
                                    )}
                                    <span className="text-xs truncate max-w-[160px]">{p.email}</span>
                                    {p.overrideAction === 'downgraded' && (
                                        <Badge className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30 px-1.5">
                                            Max: {p.role}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline">{p.role}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                                {p.scope === "explicit"
                                    ? "Explicit"
                                    : p.sourceNodeId
                                        ? `Inherited from "${state.nodes[p.sourceNodeId]?.name || p.sourceNodeId}"`
                                        : "Inherited"}
                            </TableCell>
                        </TableRow>
                    ))}
                    {effectivePolicy.principals.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-4">
                                No principals defined
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

// ─── Table B: Explicit Policy (Editable) ────────────────────
function ExplicitPolicyTable({
    node,
    state,
    onToggleLimited,
    onClearLimited,
    onAddPrincipal,
    onRemovePrincipal,
}: {
    node: FolderNode;
    state: TemplateTreeState;
    onToggleLimited: (value: boolean) => void;
    onClearLimited: () => void;
    onAddPrincipal: (type: "groups" | "users") => void;
    onRemovePrincipal: (type: "groups" | "users", email: string) => void;
}) {
    const { explicitPolicy, uiLockState, derivedPolicy } = node;
    const isExplicitlySet = explicitPolicy.limitedAccess !== undefined;

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <h3 className="font-semibold text-sm">Explicit Policy</h3>
                <Badge variant="outline" className="text-xs">Editable</Badge>
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[200px]">Property</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {/* Limited Access Row */}
                    <TableRow>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                <Lock className="h-3.5 w-3.5 text-amber-500" />
                                Limited Access
                            </div>
                        </TableCell>
                        <TableCell>
                            {uiLockState.limitedToggleLocked ? (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="flex items-center gap-2">
                                                <Switch disabled checked={true} />
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="max-w-[250px]">
                                            <p className="font-semibold text-xs">Locked by Restrictive Tree</p>
                                            <p className="text-xs text-muted-foreground">This folder or its parent enforces Limited Access</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={derivedPolicy.limitedAccess}
                                        onCheckedChange={(checked) => onToggleLimited(checked)}
                                    />
                                    {!isExplicitlySet && (
                                        <span className="text-xs text-muted-foreground italic">
                                            (inheriting)
                                        </span>
                                    )}
                                </div>
                            )}
                        </TableCell>
                        <TableCell />
                    </TableRow>

                    {/* Groups Row */}
                    <TableRow>
                        <TableCell className="font-medium align-top pt-3">
                            <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-blue-500" />
                                Groups
                            </div>
                        </TableCell>
                        <TableCell>
                            {explicitPolicy.groups.length > 0 ? (
                                <div className="space-y-1">
                                    {explicitPolicy.groups.map((g) => (
                                        <div
                                            key={g.email}
                                            className="flex items-center justify-between py-1 px-2 rounded border text-sm"
                                        >
                                            <span className="truncate max-w-[180px] text-xs">{g.email}</span>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-xs">{g.role}</Badge>
                                                <button
                                                    onClick={() => onRemovePrincipal("groups", g.email)}
                                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">
                                    None (inheriting only)
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="align-top pt-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onAddPrincipal("groups")}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                            </Button>
                        </TableCell>
                    </TableRow>

                    {/* Users Row */}
                    <TableRow>
                        <TableCell className="font-medium align-top pt-3">
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 text-green-500" />
                                Users
                            </div>
                        </TableCell>
                        <TableCell>
                            {explicitPolicy.users.length > 0 ? (
                                <div className="space-y-1">
                                    {explicitPolicy.users.map((u) => (
                                        <div
                                            key={u.email}
                                            className="flex items-center justify-between py-1 px-2 rounded border text-sm"
                                        >
                                            <span className="truncate max-w-[180px] text-xs">{u.email}</span>
                                            <div className="flex items-center gap-1.5">
                                                <Badge variant="outline" className="text-xs">{u.role}</Badge>
                                                <button
                                                    onClick={() => onRemovePrincipal("users", u.email)}
                                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">
                                    None (inheriting only)
                                </span>
                            )}
                        </TableCell>
                        <TableCell className="align-top pt-3">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => onAddPrincipal("users")}
                            >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                            </Button>
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}

// ─── Downgrade Role Picker Inline ───────────────────────────
const DOWNGRADE_ROLES: DriveRole[] = ['reader', 'commenter', 'writer'];

// ─── Table C: Principals Breakdown ──────────────────────────
function PrincipalsBreakdownTable({
    node,
    state,
    onRemove,
    onOverrideRemove,
    onUndoOverrideRemove,
    onOverrideDowngrade,
    onUndoOverrideDowngrade,
}: {
    node: FolderNode;
    state: TemplateTreeState;
    onRemove: (type: "groups" | "users", email: string) => void;
    onOverrideRemove: (type: "group" | "user", email: string) => void;
    onUndoOverrideRemove: (email: string) => void;
    onOverrideDowngrade: (type: "group" | "user", email: string, role: DriveRole) => void;
    onUndoOverrideDowngrade: (email: string) => void;
}) {
    const principals = node.effectivePolicy.principals;
    const activeCount = principals.filter(p => p.overrideAction !== 'removed').length;
    const removedCount = principals.filter(p => p.overrideAction === 'removed').length;

    // Sort: explicit first, then inherited active, then removed at bottom
    const sorted = [...principals].sort((a, b) => {
        const order = { explicit: 0, inherited: 1 };
        const overrideOrder = { none: 0, downgraded: 1, removed: 2 };
        const aOverride = overrideOrder[a.overrideAction || 'none'] ?? 0;
        const bOverride = overrideOrder[b.overrideAction || 'none'] ?? 0;
        if (aOverride !== bOverride) return aOverride - bOverride;
        const aScope = a.scope === 'explicit' ? order.explicit : order.inherited;
        const bScope = b.scope === 'explicit' ? order.explicit : order.inherited;
        return aScope - bScope;
    });

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                <h3 className="font-semibold text-sm">Principals Breakdown</h3>
                <Badge variant="outline" className="text-xs">
                    {activeCount} active
                </Badge>
                {removedCount > 0 && (
                    <Badge variant="outline" className="text-xs text-red-500 border-red-500/30">
                        {removedCount} removed
                    </Badge>
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[60px]">Type</TableHead>
                        <TableHead>Identifier</TableHead>
                        <TableHead className="w-[100px]">Inherited Role</TableHead>
                        <TableHead className="w-[100px]">Effective Role</TableHead>
                        <TableHead className="w-[120px]">Source</TableHead>
                        <TableHead className="w-[150px]">Override</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sorted.map((p, i) => {
                        const isInherited = p.scope === "inherited";
                        const isRemoved = p.overrideAction === 'removed';
                        const isDowngraded = p.overrideAction === 'downgraded';

                        return (
                            <TableRow
                                key={`${p.email}-${i}`}
                                className={`${isRemoved
                                        ? 'opacity-40 bg-red-500/5'
                                        : isDowngraded
                                            ? 'bg-orange-500/5'
                                            : isInherited
                                                ? 'opacity-70'
                                                : ''
                                    }`}
                            >
                                <TableCell>
                                    {p.type === "group" ? (
                                        <Badge variant="outline" className="text-xs">
                                            <Users className="h-3 w-3 mr-1" />
                                            Group
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-xs">
                                            <User className="h-3 w-3 mr-1" />
                                            User
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className={`text-xs font-mono truncate max-w-[200px] ${isRemoved ? 'line-through' : ''}`}>
                                    {p.email}
                                </TableCell>
                                {/* Inherited Role */}
                                <TableCell>
                                    {isInherited ? (
                                        <Badge variant="outline" className="text-xs">
                                            {isDowngraded ? p.inheritedRole : p.role}
                                        </Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                </TableCell>
                                {/* Effective Role */}
                                <TableCell>
                                    {isRemoved ? (
                                        <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30 line-through px-1.5">
                                            {p.role}
                                        </Badge>
                                    ) : isDowngraded ? (
                                        <Badge className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30 px-1.5">
                                            {p.role}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-xs">{p.role}</Badge>
                                    )}
                                </TableCell>
                                {/* Source */}
                                <TableCell>
                                    {isRemoved ? (
                                        <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/30 px-1.5">
                                            <Ban className="h-3 w-3 mr-1" />
                                            Removed here
                                        </Badge>
                                    ) : isDowngraded ? (
                                        <Badge className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30 px-1.5">
                                            <ArrowDown className="h-3 w-3 mr-1" />
                                            Max: {p.role}
                                        </Badge>
                                    ) : isInherited ? (
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-xs border-dashed"
                                                    >
                                                        Inherited
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    From: {state.nodes[p.sourceNodeId!]?.name || "unknown"}
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <Badge className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                            Explicit
                                        </Badge>
                                    )}
                                </TableCell>
                                {/* Override Controls */}
                                <TableCell>
                                    {isRemoved ? (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs px-2"
                                            onClick={() => onUndoOverrideRemove(p.email)}
                                        >
                                            <Undo2 className="h-3 w-3 mr-1" />
                                            Undo
                                        </Button>
                                    ) : isDowngraded ? (
                                        <div className="flex items-center gap-1">
                                            <Select
                                                value={p.role}
                                                onValueChange={(v) =>
                                                    onOverrideDowngrade(p.type, p.email, v as DriveRole)
                                                }
                                            >
                                                <SelectTrigger className="h-6 text-xs w-[80px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {DOWNGRADE_ROLES.filter(
                                                        r => ROLE_RANK[r] < ROLE_RANK[p.inheritedRole || p.role]
                                                    ).map(r => (
                                                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0"
                                                onClick={() => onUndoOverrideDowngrade(p.email)}
                                            >
                                                <Undo2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ) : !isInherited ? (
                                        <button
                                            onClick={() =>
                                                onRemove(
                                                    p.type === "group" ? "groups" : "users",
                                                    p.email
                                                )
                                            }
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                            title="Remove from explicit policy"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    ) : (
                                        /* Inherited, no override — show override controls */
                                        <div className="flex items-center gap-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 text-xs px-1.5 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                                            onClick={() => onOverrideRemove(p.type, p.email)}
                                                        >
                                                            <Ban className="h-3 w-3" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Remove here (deny locally)</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <Select
                                                onValueChange={(v) =>
                                                    onOverrideDowngrade(p.type, p.email, v as DriveRole)
                                                }
                                            >
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <SelectTrigger className="h-6 text-xs w-[28px] px-1">
                                                                <ArrowDown className="h-3 w-3" />
                                                            </SelectTrigger>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Downgrade role (reduce locally)</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                                <SelectContent>
                                                    {DOWNGRADE_ROLES.filter(
                                                        r => ROLE_RANK[r] < ROLE_RANK[p.role]
                                                    ).map(r => (
                                                        <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {sorted.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-6">
                                No principals assigned to this folder
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

// ─── Add Principal Dialog ───────────────────────────────────
function AddPrincipalDialog({
    open,
    onClose,
    type,
    allGroups,
    allUsers,
    onAdd,
}: {
    open: boolean;
    onClose: () => void;
    type: "groups" | "users";
    allGroups: { email: string; name?: string }[];
    allUsers: { email: string; name?: string }[];
    onAdd: (email: string, role: "reader" | "writer" | "organizer") => void;
}) {
    const [search, setSearch] = useState("");
    const [selectedRole, setSelectedRole] = useState<"reader" | "writer" | "organizer">("writer");
    const [customEmail, setCustomEmail] = useState("");

    const items = type === "groups" ? allGroups : allUsers;
    const filtered = items.filter(
        (item) =>
            item.email.toLowerCase().includes(search.toLowerCase()) ||
            (item.name && item.name.toLowerCase().includes(search.toLowerCase()))
    );

    const handleAdd = (email: string) => {
        onAdd(email, selectedRole);
        toast.success(`Added ${email} as ${selectedRole}`);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Add {type === "groups" ? "Group" : "User"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="flex gap-2">
                        <Input
                            placeholder={`Search ${type}...`}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1"
                        />
                        <Select
                            value={selectedRole}
                            onValueChange={(v) => setSelectedRole(v as "reader" | "writer" | "organizer")}
                        >
                            <SelectTrigger className="w-[120px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="reader">Reader</SelectItem>
                                <SelectItem value="writer">Writer</SelectItem>
                                <SelectItem value="organizer">Organizer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <ScrollArea className="h-[250px]">
                        <div className="space-y-1 p-1">
                            {filtered.map((item) => (
                                <div
                                    key={item.email}
                                    className="flex items-center justify-between p-2 rounded hover:bg-muted cursor-pointer text-sm"
                                    onClick={() => handleAdd(item.email)}
                                >
                                    <div>
                                        <div className="font-medium text-xs">{item.name || item.email}</div>
                                        {item.name && (
                                            <div className="text-xs text-muted-foreground">{item.email}</div>
                                        )}
                                    </div>
                                    <Plus className="h-4 w-4 text-muted-foreground" />
                                </div>
                            ))}
                            {filtered.length === 0 && (
                                <div className="py-4 text-center text-muted-foreground text-sm">
                                    No matches found
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="border-t pt-3">
                        <p className="text-xs text-muted-foreground mb-2">Or enter manually:</p>
                        <div className="flex gap-2">
                            <Input
                                placeholder="email@domain.com"
                                value={customEmail}
                                onChange={(e) => setCustomEmail(e.target.value)}
                                className="flex-1 text-sm"
                            />
                            <Button
                                size="sm"
                                onClick={() => {
                                    if (customEmail.includes("@")) {
                                        handleAdd(customEmail);
                                        setCustomEmail("");
                                    }
                                }}
                                disabled={!customEmail.includes("@")}
                            >
                                Add
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ─── Save Status Indicator ──────────────────────────────────
function SaveIndicator({
    status,
    lastSavedAt,
}: {
    status: "idle" | "dirty" | "saving" | "saved" | "error";
    lastSavedAt: number | null;
}) {
    return (
        <div className="flex items-center gap-1.5 text-xs">
            {status === "saving" && (
                <>
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-blue-500">Saving...</span>
                </>
            )}
            {status === "saved" && (
                <>
                    <Check className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">
                        Saved {lastSavedAt ? new Date(lastSavedAt).toLocaleTimeString() : ""}
                    </span>
                </>
            )}
            {status === "dirty" && (
                <>
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-amber-500">Unsaved changes</span>
                </>
            )}
            {status === "error" && (
                <>
                    <AlertTriangle className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">Save failed</span>
                </>
            )}
            {status === "idle" && lastSavedAt && (
                <>
                    <Check className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                        Saved {new Date(lastSavedAt).toLocaleTimeString()}
                    </span>
                </>
            )}
        </div>
    );
}

// ─── Main Template Editor Page ──────────────────────────────
export default function TemplateEditorV2() {
    // Core state
    const [treeState, setTreeState] = useState<TemplateTreeState | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    // Save state
    const [saveStatus, setSaveStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const [templateVersion, setTemplateVersion] = useState<number | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const saveVersionRef = useRef(0);

    // Dialog state
    const [addPrincipalDialog, setAddPrincipalDialog] = useState<{
        open: boolean;
        type: "groups" | "users";
    }>({ open: false, type: "groups" });
    const [allGroups, setAllGroups] = useState<{ email: string; name?: string }[]>([]);
    const [allUsers, setAllUsers] = useState<{ email: string; name?: string }[]>([]);

    // ─── Load Template ──────────────────────────────────────
    const loadTemplate = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/template");
            const data = await res.json();

            if (data.success && data.template && Array.isArray(data.template.template_json)) {
                const state = deserializeTemplate(data.template.template_json);
                setTreeState(state);
                setTemplateVersion(data.template.version_number);

                // Auto-expand roots
                setExpandedIds(new Set(state.rootIds));

                // Select first root
                if (state.rootIds.length > 0) {
                    setSelectedNodeId(state.rootIds[0]);
                }
            }
        } catch (error) {
            console.error("Error loading template:", error);
            toast.error("Failed to load template");
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch groups and users for add dialog
    const fetchPrincipals = useCallback(async () => {
        try {
            const [groupsRes, usersRes] = await Promise.all([
                fetch("/api/groups"),
                fetch("/api/users"),
            ]);
            const [groupsData, usersData] = await Promise.all([
                groupsRes.json(),
                usersRes.json(),
            ]);
            if (groupsData.groups) {
                setAllGroups(
                    groupsData.groups.map((g: any) => ({
                        email: g.email,
                        name: g.name || g.email,
                    }))
                );
            }
            if (usersData.users) {
                setAllUsers(
                    usersData.users.map((u: any) => ({
                        email: u.email,
                        name: u.display_name || u.email,
                    }))
                );
            }
        } catch (error) {
            console.error("Error fetching principals:", error);
        }
    }, []);

    useEffect(() => {
        loadTemplate();
        fetchPrincipals();
    }, [loadTemplate, fetchPrincipals]);

    // ─── Auto-Save Logic ────────────────────────────────────
    const triggerAutoSave = useCallback(
        (newState: TemplateTreeState) => {
            // Clear existing timer
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            // Increment version for race condition prevention
            saveVersionRef.current++;
            const currentVersion = saveVersionRef.current;

            setSaveStatus("dirty");

            saveTimerRef.current = setTimeout(async () => {
                // Check if this save is still current
                if (saveVersionRef.current !== currentVersion) return;

                try {
                    setSaveStatus("saving");
                    const payload = serializeTemplate(newState);
                    const res = await fetch("/api/template", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ template_json: payload }),
                    });
                    const data = await res.json();

                    // Check again after async
                    if (saveVersionRef.current !== currentVersion) return;

                    if (data.success) {
                        setSaveStatus("saved");
                        setLastSavedAt(Date.now());
                        setTemplateVersion(data.version);
                    } else {
                        setSaveStatus("error");
                        toast.error("Failed to save: " + (data.error || "Unknown error"));
                    }
                } catch {
                    if (saveVersionRef.current === currentVersion) {
                        setSaveStatus("error");
                        toast.error("Failed to save template");
                    }
                }
            }, AUTO_SAVE_DEBOUNCE_MS);
        },
        []
    );

    // ─── State Mutation Wrappers ────────────────────────────
    const updateState = useCallback(
        (newState: TemplateTreeState) => {
            setTreeState(newState);
            triggerAutoSave(newState);
        },
        [triggerAutoSave]
    );

    const handleToggleLimited = useCallback(
        (value: boolean) => {
            if (!treeState || !selectedNodeId) return;
            const newState = toggleLimitedAccess(treeState, selectedNodeId, value);
            updateState(newState);
        },
        [treeState, selectedNodeId, updateState]
    );

    const handleClearLimited = useCallback(() => {
        if (!treeState || !selectedNodeId) return;
        const newState = clearLimitedAccess(treeState, selectedNodeId);
        updateState(newState);
    }, [treeState, selectedNodeId, updateState]);

    const handleAddPrincipal = useCallback(
        (email: string, role: "reader" | "writer" | "organizer") => {
            if (!treeState || !selectedNodeId) return;
            const newState = addPrincipal(
                treeState,
                selectedNodeId,
                addPrincipalDialog.type,
                { email, role }
            );
            updateState(newState);
        },
        [treeState, selectedNodeId, addPrincipalDialog.type, updateState]
    );

    const handleRemovePrincipal = useCallback(
        (type: "groups" | "users", email: string) => {
            if (!treeState || !selectedNodeId) return;
            const newState = removePrincipal(treeState, selectedNodeId, type, email);
            updateState(newState);
        },
        [treeState, selectedNodeId, updateState]
    );

    // ─── Override Handlers ──────────────────────────────
    const handleOverrideRemove = useCallback(
        (type: "group" | "user", email: string) => {
            if (!treeState || !selectedNodeId) return;
            const newState = addOverrideRemove(treeState, selectedNodeId, type, email);
            updateState(newState);
            toast.success(`Removed ${email} at this folder`);
        },
        [treeState, selectedNodeId, updateState]
    );

    const handleUndoOverrideRemove = useCallback(
        (email: string) => {
            if (!treeState || !selectedNodeId) return;
            const newState = removeOverrideRemove(treeState, selectedNodeId, email);
            updateState(newState);
        },
        [treeState, selectedNodeId, updateState]
    );

    const handleOverrideDowngrade = useCallback(
        (type: "group" | "user", email: string, role: DriveRole) => {
            if (!treeState || !selectedNodeId) return;
            const newState = setOverrideDowngrade(treeState, selectedNodeId, type, email, role);
            updateState(newState);
            toast.success(`Set max role for ${email} to ${role}`);
        },
        [treeState, selectedNodeId, updateState]
    );

    const handleUndoOverrideDowngrade = useCallback(
        (email: string) => {
            if (!treeState || !selectedNodeId) return;
            const newState = removeOverrideDowngrade(treeState, selectedNodeId, email);
            updateState(newState);
        },
        [treeState, selectedNodeId, updateState]
    );

    const handleToggleExpand = useCallback((nodeId: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // ─── Render ─────────────────────────────────────────────
    if (loading || !treeState) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const selectedNode = selectedNodeId ? treeState.nodes[selectedNodeId] : null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Template Editor</h1>
                    <p className="text-muted-foreground text-sm">
                        Live policy editor — changes auto-save
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <SaveIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
                    <Badge variant="outline" className="text-sm">
                        {templateVersion ? `v${templateVersion}` : "Draft"}
                    </Badge>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const blob = new Blob(
                                [JSON.stringify(serializeTemplate(treeState), null, 2)],
                                { type: "application/json" }
                            );
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `template_v${templateVersion || "draft"}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Template downloaded");
                        }}
                    >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Main Layout: Left Tree + Right Policy Panel */}
            <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                {/* LEFT PANEL: Folder Tree (Navigation Only) */}
                <Card className="h-[calc(100vh-200px)] flex flex-col">
                    <CardHeader className="py-3 px-4 flex-shrink-0">
                        <CardTitle className="text-sm">Folder Tree</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden px-2 pb-2">
                        <ScrollArea className="h-full">
                            {treeState.rootIds.map((rootId) => (
                                <TreeNode
                                    key={rootId}
                                    nodeId={rootId}
                                    state={treeState}
                                    selectedId={selectedNodeId}
                                    expandedIds={expandedIds}
                                    onSelect={setSelectedNodeId}
                                    onToggleExpand={handleToggleExpand}
                                />
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* RIGHT PANEL: Policy Tables */}
                <div className="h-[calc(100vh-200px)] overflow-hidden">
                    {selectedNode ? (
                        <Card className="h-full flex flex-col">
                            <CardHeader className="py-3 px-4 flex-shrink-0 border-b">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Folder className="h-5 w-5 text-amber-500" />
                                            {selectedNode.name}
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            ID: {selectedNode.id} •
                                            {selectedNode.parentId
                                                ? ` Parent: ${treeState.nodes[selectedNode.parentId]?.name}`
                                                : " Root folder"}
                                        </p>
                                    </div>
                                    {selectedNode.effectivePolicy.limitedAccess && (
                                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                                            <Lock className="h-3 w-3 mr-1" />
                                            Limited Access
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto px-4 py-3">
                                <ScrollArea className="h-full">
                                    <div className="space-y-6 pr-2">
                                        {/* Table A: Effective Policy */}
                                        <EffectivePolicyTable node={selectedNode} state={treeState} />

                                        {/* Divider */}
                                        <div className="border-t" />

                                        {/* Table B: Explicit Policy */}
                                        <ExplicitPolicyTable
                                            node={selectedNode}
                                            state={treeState}
                                            onToggleLimited={handleToggleLimited}
                                            onClearLimited={handleClearLimited}
                                            onAddPrincipal={(type) =>
                                                setAddPrincipalDialog({ open: true, type })
                                            }
                                            onRemovePrincipal={handleRemovePrincipal}
                                        />

                                        {/* Divider */}
                                        <div className="border-t" />

                                        {/* Table C: Principals Breakdown */}
                                        <PrincipalsBreakdownTable
                                            node={selectedNode}
                                            state={treeState}
                                            onRemove={handleRemovePrincipal}
                                            onOverrideRemove={handleOverrideRemove}
                                            onUndoOverrideRemove={handleUndoOverrideRemove}
                                            onOverrideDowngrade={handleOverrideDowngrade}
                                            onUndoOverrideDowngrade={handleUndoOverrideDowngrade}
                                        />
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <Folder className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="font-medium">Select a folder</p>
                                <p className="text-sm">
                                    Click a folder in the tree to view and edit its policy
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Add Principal Dialog */}
            <AddPrincipalDialog
                open={addPrincipalDialog.open}
                onClose={() => setAddPrincipalDialog({ open: false, type: "groups" })}
                type={addPrincipalDialog.type}
                allGroups={allGroups}
                allUsers={allUsers}
                onAdd={handleAddPrincipal}
            />
        </div>
    );
}
