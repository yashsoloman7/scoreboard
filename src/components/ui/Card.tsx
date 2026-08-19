import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "glass rounded-xl p-6 shadow-xl transition-all hover:shadow-2xl border border-white/10",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function CardHeader({ children, className, ...props }: CardProps) {
    return <div className={cn("mb-4", className)} {...props}>{children}</div>;
}

export function CardTitle({ children, className, ...props }: CardProps) {
    return <h3 className={cn("text-xl font-bold text-white", className)} {...props}>{children}</h3>;
}

export function CardContent({ children, className, ...props }: CardProps) {
    return <div className={cn("", className)} {...props}>{children}</div>;
}
