export interface WorldSheetMutationRequestIdentity {
    remoteAddress?: string;
    origin?: string;
    userAgent?: string;
}

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const DEVELOPMENT_ORIGINS = new Set(['http://localhost:5173', 'http://127.0.0.1:5173']);

export function isTrustedWorldSheetCapabilityRequest(identity: WorldSheetMutationRequestIdentity): boolean {
    if (!identity.remoteAddress || !LOOPBACK_ADDRESSES.has(identity.remoteAddress)) return false;
    if (!identity.origin) return false;
    if (DEVELOPMENT_ORIGINS.has(identity.origin)) return true;
    return (identity.origin === 'null' || identity.origin === 'file://') && /\bElectron\//.test(identity.userAgent ?? '');
}

export function isTrustedWorldSheetMutationRequest(identity: WorldSheetMutationRequestIdentity): boolean {
    if (!identity.remoteAddress || !LOOPBACK_ADDRESSES.has(identity.remoteAddress)) return false;
    if (!identity.origin) return true;
    if (DEVELOPMENT_ORIGINS.has(identity.origin)) return true;
    if ((identity.origin === 'null' || identity.origin === 'file://') && /\bElectron\//.test(identity.userAgent ?? '')) return true;
    return false;
}
