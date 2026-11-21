import React from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

export interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  highlight?: boolean;
}

export function StatCard({ label, value, detail, highlight = false }: StatCardProps) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div
        className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${
          highlight ? 'text-cyan-400' : 'text-slate-50'
        }`}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-slate-400">{detail}</div>
    </div>
  );
}

export interface StatusNoticeProps {
  variant: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  action?: React.ReactNode;
}

export function StatusNotice({ variant, title, message, action }: StatusNoticeProps) {
  const styles = {
    info: 'border-cyan-500/30 bg-cyan-950/20 text-slate-200',
    warning: 'border-amber-500/35 bg-amber-950/20 text-amber-100',
    error: 'border-rose-500/35 bg-rose-950/20 text-rose-100',
    success: 'border-emerald-500/35 bg-emerald-950/20 text-emerald-100',
  }[variant];

  const Icon =
    variant === 'error'
      ? AlertCircle
      : variant === 'success'
        ? CheckCircle2
        : variant === 'warning'
          ? AlertCircle
          : Info;

  const iconColor = {
    info: 'text-cyan-400',
    warning: 'text-amber-400',
    error: 'text-rose-400',
    success: 'text-emerald-400',
  }[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${styles}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">{title}</div>
          <p className="text-xs leading-relaxed opacity-90">{message}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export interface OptivexLogoProps {
  compact?: boolean;
}

export function OptivexLogo({ compact = false }: OptivexLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <svg
        width="26"
        height="26"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="2" y="2" width="24" height="24" rx="6" stroke="#22D3EE" strokeWidth="1.75" />
        <path
          d="M7 10V7H10M18 7H21V10M21 18V21H18M10 21H7V18"
          stroke="#E2E8F0"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <circle cx="14" cy="14" r="3.2" stroke="#22D3EE" strokeWidth="1.75" />
      </svg>
      <span className="font-display text-lg font-bold tracking-tight text-slate-50">
        OPTIVEX{compact ? '' : ' AI'}
      </span>
    </span>
  );
}
