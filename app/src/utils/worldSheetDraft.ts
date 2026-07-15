import {
    normalizeEntitySheetSchema,
    serializeEntitySheetSchema,
    type EntitySheetSchemaV1,
    type SheetDiagnostic,
} from './entitySheetSchema';

export type WorldSheetDraftResult =
    | { ok: true; schema: EntitySheetSchemaV1; canonical: string; diagnostics: [] }
    | { ok: false; diagnostics: SheetDiagnostic[] };

export function parseWorldSheetDraft(draft: string, requiredEntityType: string): WorldSheetDraftResult {
    let parsed: unknown;
    try {
        parsed = JSON.parse(draft) as unknown;
    } catch (error) {
        return {
            ok: false,
            diagnostics: [{
                level: 'error',
                code: 'json.parse',
                message: error instanceof Error ? error.message : String(error),
                path: [],
            }],
        };
    }

    const normalized = normalizeEntitySheetSchema(parsed);
    if (normalized.ok === false) return { ok: false, diagnostics: normalized.diagnostics };
    if (!normalized.schema.entityTypes.includes(requiredEntityType as EntitySheetSchemaV1['entityTypes'][number])) {
        return {
            ok: false,
            diagnostics: [{
                level: 'error',
                code: 'schema.entityTypes.assignment',
                message: `Sheet must target entity type: ${requiredEntityType}`,
                path: ['entityTypes'],
            }],
        };
    }

    return {
        ok: true,
        schema: normalized.schema,
        canonical: serializeEntitySheetSchema(normalized.schema),
        diagnostics: [],
    };
}
