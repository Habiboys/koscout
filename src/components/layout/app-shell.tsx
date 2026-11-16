"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/search", label: "Cari" },
  { href: "/import", label: "Impor" },
  { href: "/compare", label: "Bandingkan" },
  { href: "/favorites", label: "Favorit" },
  { href: "/ai", label: "AI" },
  { href: "/settings", label: "Atur" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const wide = pathname === "/search" || pathname === "/compare";

  return (
    <>
      <header className={wide ? "shell wide" : "shell"}>
        <div className="topbar">
          <Link href="/" className="brand">
            <strong>Koscout</strong>
            <span>Biaya sewa, fasilitas, dan perjalanan ke kantor</span>
          </Link>
          <nav className="nav">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-active={pathname === link.href || pathname.startsWith(`${link.href}/`)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className={wide ? "shell wide page" : "shell page"}>{children}</main>
    </>
  );
}
