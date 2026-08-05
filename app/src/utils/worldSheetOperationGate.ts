export type WorldSheetOperationChannel = 'load' | 'import' | 'confirm' | 'mutation';

export interface WorldSheetOperationToken {
    scope: string;
    lifecycleGeneration: number;
    channel: WorldSheetOperationChannel;
    channelGeneration: number;
}

export interface WorldSheetOperationGate {
    activateScope: (scope: string) => void;
    deactivate: () => void;
    invalidate: (channel: WorldSheetOperationChannel) => void;
    begin: (channel: WorldSheetOperationChannel) => WorldSheetOperationToken;
    isScopeCurrent: (token: WorldSheetOperationToken) => boolean;
    isCurrent: (token: WorldSheetOperationToken) => boolean;
}

const createChannelGenerations = (): Record<WorldSheetOperationChannel, number> => ({
    load: 0,
    import: 0,
    confirm: 0,
    mutation: 0,
});

export function createWorldSheetOperationGate(): WorldSheetOperationGate {
    let scope = '';
    let lifecycleGeneration = 0;
    let active = false;
    const channelGenerations = createChannelGenerations();

    const advanceLifecycle = () => {
        lifecycleGeneration += 1;
        for (const channel of Object.keys(channelGenerations) as WorldSheetOperationChannel[]) {
            channelGenerations[channel] += 1;
        }
    };

    const isScopeCurrent = (token: WorldSheetOperationToken) => (
        active
        && token.scope === scope
        && token.lifecycleGeneration === lifecycleGeneration
    );

    return {
        activateScope(nextScope) {
            scope = nextScope;
            active = true;
            advanceLifecycle();
        },
        deactivate() {
            active = false;
            advanceLifecycle();
        },
        invalidate(channel) {
            channelGenerations[channel] += 1;
        },
        begin(channel) {
            channelGenerations[channel] += 1;
            return {
                scope,
                lifecycleGeneration,
                channel,
                channelGeneration: channelGenerations[channel],
            };
        },
        isScopeCurrent,
        isCurrent(token) {
            return isScopeCurrent(token)
                && token.channelGeneration === channelGenerations[token.channel];
        },
    };
}
