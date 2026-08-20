'use client';

// src/components/ui/ConfirmationDialog.tsx - Reusable Yes/No Confirmation Modal
import React from 'react';
import { AlertTriangle, AlertCircle, Trash2, CheckCircle2, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmationDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Yes, Proceed',
  cancelLabel = 'No, Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-red-400" />,
          btn: 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950',
          badge: 'bg-red-500/10 text-red-400 border-red-500/20',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-400" />,
          btn: 'bg-amber-600 hover:bg-amber-500 text-slate-950 shadow-lg shadow-amber-950 font-black',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'primary':
      default:
        return {
          icon: <AlertCircle className="w-6 h-6 text-cyan-400" />,
          btn: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950 font-black',
          badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${styles.badge}`}>
              {styles.icon}
            </div>
            <div>
              <h3 className="font-bold text-lg text-white leading-snug">{title}</h3>
              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Action Confirmation</span>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
          {message}
        </p>

        {/* Actions (Yes & No) */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${styles.btn}`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
