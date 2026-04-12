import { Music2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthShell({
  title,
  subtitle,
  eyebrow = '',
  accent = '',
  children,
  footer,
  compact = false,
}) {
  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className="glass-card relative w-full max-w-md overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_28%)]" />
        <div className="relative z-10">
          <div className="mb-8 flex justify-center">
            <Link to="/login" className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.3)]">
              <Music2 size={28} className="text-white" />
            </Link>
          </div>

          <div className="mb-8 space-y-2 text-center">
            {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.35em] text-slate-500">{eyebrow}</p> : null}
            <h1 className="text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">{title}</h1>
            {subtitle ? <p className="text-sm leading-6 text-slate-300">{subtitle}</p> : null}
            {accent ? <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">{accent}</p> : null}
          </div>

          {children}

          {footer && <div className="mt-6 border-t border-white/10 pt-5">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
