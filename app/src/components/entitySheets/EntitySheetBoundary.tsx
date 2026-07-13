import type { ReactNode } from 'react';
import type { Entity } from '../../types';
import { normalizeEntitySheetSchema } from '../../utils/entitySheetSchema';
import { EntitySheetRenderer } from './EntitySheetRenderer';

interface EntitySheetBoundaryProps {
    entity: Entity;
    schema: unknown;
    fallback: ReactNode;
    showDiagnostics?: boolean;
}

export function EntitySheetBoundary({
    entity,
    schema,
    fallback,
    showDiagnostics = false,
}: EntitySheetBoundaryProps) {
    const result = normalizeEntitySheetSchema(schema);
    if (!result.ok) {
        return (
            <>
                {fallback}
                {showDiagnostics && (
                    <aside
                        data-entity-sheet-diagnostics
                        className="mt-[var(--vibe-space-gap)] rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-warning)] bg-[var(--vibe-surface-block)] p-[var(--vibe-space-block)] text-xs text-[var(--vibe-warning)]"
                    >
                        {result.diagnostics.map((diagnostic) => (
                            <div key={`${diagnostic.code}:${diagnostic.path.join('.')}`}>
                                {diagnostic.code}: {diagnostic.message}
                            </div>
                        ))}
                    </aside>
                )}
            </>
        );
    }

    return <EntitySheetRenderer entity={entity} schema={result.schema} />;
}
