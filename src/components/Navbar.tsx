'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

interface SessionUser {
  id: string;
  secondmeUserId?: string | null;
  name?: string | null;
}

interface SessionResponse {
  authenticated: boolean;
  user?: SessionUser;
}

export function Navbar() {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const links = [
    { href: '/', label: '首页' },
    { href: '/play', label: '快速开战' },
    { href: '/leaderboard', label: '排行榜' }
  ];

  const loginHref = useMemo(() => {
    const returnTo = pathname || '/';
    return `/api/auth/login?return_to=${encodeURIComponent(returnTo)}`;
  }, [pathname]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' });
        if (!active) {
          return;
        }
        if (!res.ok) {
          setSession({ authenticated: false });
          return;
        }
        const data = (await res.json()) as SessionResponse;
        setSession(data);
      } catch {
        if (active) {
          setSession({ authenticated: false });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/';
    }
  }

  const displayName = session?.user?.name || session?.user?.secondmeUserId || 'SecondMe 用户';

  return (
    <nav className="navbar" role="navigation" aria-label="主导航">
      <div className="navbar__inner">
        <Link href="/" className="navbar__brand">
          <span className="navbar__brand-icon" aria-hidden="true">
            A
          </span>
          A2A 猜词王
        </Link>

        <div className="navbar__links">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`navbar__link ${
                pathname === link.href ? 'navbar__link--active' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
          {loading ? (
            <span className="navbar__status">检查登录中...</span>
          ) : session?.authenticated ? (
            <>
              <span className="navbar__user">{displayName}</span>
              <button type="button" className="btn btn--ghost btn--sm navbar__cta" onClick={() => void handleLogout()}>
                退出
              </button>
            </>
          ) : (
            <Link href={loginHref} className="btn btn--primary btn--sm navbar__cta">
              SecondMe 登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
