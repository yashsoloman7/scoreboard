"use client";

import React, {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect,
    useCallback,
    ReactNode
} from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

// Context for controlling the Select state (used by Item, Trigger)
interface SelectContextType {
    value: string;
    onValueChange: (value: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    registerLabel: (value: string, label: ReactNode) => void;
}

// Context for displaying the value (used ONLY by SelectValue)
interface SelectValueContextType {
    value: string;
    labels: Record<string, ReactNode>;
}

const SelectContext = createContext<SelectContextType | undefined>(undefined);
const SelectValueContext = createContext<SelectValueContextType | undefined>(undefined);

interface SelectProps {
    children: ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
}

export const Select = ({ children, value = "", onValueChange, className }: SelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [labels, setLabels] = useState<Record<string, ReactNode>>({});
    const containerRef = useRef<HTMLDivElement>(null);

    // Stable register callback
    const registerLabel = useCallback((val: string, label: ReactNode) => {
        setLabels(prev => {
            // If the label content hasn't changed (by reference or simple check), don't update
            // However, ReactNode equality is hard. 
            // We rely on the Split Context to prevent the infinite loop.
            // Even if we update state here, only SelectValueContext consumers will re-render.
            // SelectContext consumers (SelectItem) will NOT re-render because `registerLabel` is memoized
            // and isOpen/value/onValueChange change independently.
            return { ...prev, [val]: label };
        });
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleValueChange = useCallback((val: string) => {
        if (onValueChange) onValueChange(val);
    }, [onValueChange]);

    return (
        <SelectContext.Provider value={{
            value,
            onValueChange: handleValueChange,
            isOpen,
            setIsOpen,
            registerLabel
        }}>
            <SelectValueContext.Provider value={{ value, labels }}>
                <div className={cn("relative w-full", className)} ref={containerRef}>
                    {children}
                </div>
            </SelectValueContext.Provider>
        </SelectContext.Provider>
    );
};

export const SelectTrigger = ({ children, className }: { children: ReactNode, className?: string }) => {
    const context = useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used within a Select");

    return (
        <div
            onClick={() => context.setIsOpen(!context.isOpen)}
            className={cn(
                "flex items-center justify-between cursor-pointer",
                className
            )}
        >
            {children}
            <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", context.isOpen && "rotate-180")} />
        </div>
    );
};

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const context = useContext(SelectValueContext);
    if (!context) throw new Error("SelectValue must be used within a Select");

    const content = context.labels[context.value] || <span className="text-gray-400">{placeholder || "Select an option"}</span>;

    return <span className="block truncate">{content}</span>;
};

export const SelectContent = ({ children, className }: { children: ReactNode, className?: string }) => {
    // SelectContent needs to know state to toggle visibility
    const context = useContext(SelectContext);
    if (!context) throw new Error("SelectContent must be used within a Select");

    if (!context.isOpen) {
        return <div className="hidden">{children}</div>;
    }

    return (
        <div className={cn(
            "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-700 bg-gray-900 shadow-md animate-in fade-in-0 zoom-in-95 w-full mt-1",
            className
        )}>
            <div className="p-1 max-h-[300px] overflow-y-auto">
                {children}
            </div>
        </div>
    );
};

export const SelectItem = ({ value, children, className }: { value: string, children: ReactNode, className?: string }) => {
    const context = useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used within a Select");

    // This effect runs on mount and whenever children change.
    // It calls `registerLabel`.
    // `registerLabel` updates `labels` state in `Select`.
    // `Select` re-renders. 
    // `SelectContext` provider value recreates? 
    // We memoized `registerLabel` and `handleValueChange`.
    // `isOpen` and `setIsOpen` are stable-ish.
    // We need to ensure `SelectContext` value object itself is stable if `labels` changes.
    // In `Select`, the provider value is `{ value, onValueChange, isOpen, setIsOpen, registerLabel }`.
    // `labels` is NOT in this object.
    // So if `labels` changes, `SelectContext` value remains referentially equal (assuming value/isOpen didn't change).
    // Thus `SelectItem` does NOT re-render. Loop broken.
    useEffect(() => {
        context.registerLabel(value, children);
    }, [value, children, context.registerLabel]);

    const isSelected = context.value === value;

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                context.onValueChange(value);
                context.setIsOpen(false);
            }}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-white/10 hover:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
                isSelected && "bg-white/10 text-white",
                className
            )}
        >
            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            <div className="flex items-center w-full">{children}</div>
        </div>
    );
};
