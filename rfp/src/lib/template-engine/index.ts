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
} from './engine';
