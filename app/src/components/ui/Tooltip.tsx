import React, { useState } from 'react';
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    useHover,
    useFocus,
    useDismiss,
    useRole,
    useClick,
    useInteractions,
    FloatingPortal,
} from '@floating-ui/react';
import type { Placement } from '@floating-ui/react';

interface TooltipProps {
    children: React.ReactNode;
    content: React.ReactNode;
    placement?: Placement;
    className?: string;
    delay?: number;
}

export function Tooltip({ children, content, placement = 'top', className = '', delay = 0 }: TooltipProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            flip({ fallbackAxisSideDirection: 'start', crossAxis: false }),
            shift({ padding: 8 })
        ]
    });

    const hover = useHover(context, { move: false, delay: { open: delay, close: 0 } });
    const focus = useFocus(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'tooltip' });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        focus,
        dismiss,
        role
    ]);

    return (
        <>
            <div ref={refs.setReference} {...getReferenceProps()} className={`inline-flex ${className}`}>
                {children}
            </div>
            <FloatingPortal>
                {isOpen && (
                    <div
                        ref={refs.setFloating}
                        style={floatingStyles}
                        {...getFloatingProps()}
                        className="z-[9999]" // Ensure super high z-index overlay
                    >
                        {content}
                    </div>
                )}
            </FloatingPortal>
        </>
    );
}

// Similar popover for interactions (clicks)
export function Popover({ children, content, placement = 'bottom', className = '' }: TooltipProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            flip({ fallbackAxisSideDirection: 'start', crossAxis: false }),
            shift({ padding: 8 })
        ]
    });

    // Use click for popover since it contains interactive inputs
    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context, { role: 'dialog' });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        role
    ]);

    return (
        <>
            <div ref={refs.setReference} {...getReferenceProps()} className={`inline-flex ${className}`}>
                {children}
            </div>
            <FloatingPortal>
                {isOpen && (
                    <div
                        ref={refs.setFloating}
                        style={{ ...floatingStyles, pointerEvents: 'auto' }}
                        {...getFloatingProps()}
                        className="z-[9999]"
                    >
                        {content}
                    </div>
                )}
            </FloatingPortal>
        </>
    );
}
