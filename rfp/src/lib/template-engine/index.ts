/**
 * Template Engine — Public API
 * 
 * Re-exports all types and functions needed by consumers.
 */

// Types
export type {
    ExplicitPrincipal,
    EffectivePrincipal,
    ExplicitPolicy,
    DerivedPolicy,
    EffectivePolicy,
    UiLockState,
    FolderNode,
    TemplateTreeState,
    RawTemplateNode,
    DriveRole,
    Overrides,
    OverrideEntry,
    DowngradeEntry,
} from './types';

// Runtime values from types
export {
    ROLE_RANK,
    roleRank,
    normalizeRoleForRank,
    isRoleLessOrEqual,
    hasActiveOverrides,
} from './types';

// Engine functions
export {
    recomputeSubtree,
    recomputeFullTree,
    enforceStructuralSafety,
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
    validateOverrides,
} from './engine';
