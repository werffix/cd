import { Link } from 'react-router-dom';
import siteLogo from '../assets/site-logo.png';

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
    <div className="app-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="auth-aurora" />
      <section className="glass-card relative w-full max-w-md overflow-hidden bg-[#121212] p-6 sm:p-8">
        <div className="relative z-10">
          <div className="mb-8 flex justify-center">
            <Link to="/login" className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-transparent shadow-none">
              <img src={siteLogo} alt="CDCULT" className="h-full w-full object-contain" />
            </Link>
          </div>

          <div className="mb-8 space-y-2 text-center">
            {eyebrow ? <p className="text-xs font-bold uppercase tracking-[0.35em] text-zinc-500">{eyebrow}</p> : null}
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h1>
            {subtitle ? <p className="text-sm leading-6 text-zinc-400">{subtitle}</p> : null}
            {accent ? <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">{accent}</p> : null}
          </div>

          {children}

          {footer && <div className="mt-6 border-t border-white/10 pt-5 text-center">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
