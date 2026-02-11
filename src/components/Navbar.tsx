'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/play', label: 'Play' },
    { href: '/leaderboard', label: 'Leaderboard' }
  ];

  return (
    <nav className="navbar" role="navigation" aria-label="Main navigation">
      <div className="navbar__inner">
        <Link href="/" className="navbar__brand">
          <span className="navbar__brand-icon" aria-hidden="true">
            A
          </span>
          A2A Guess Word
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
          <Link href="/play" className="btn btn--primary btn--sm navbar__cta">
            Start Game
          </Link>
        </div>
      </div>
    </nav>
  );
}
