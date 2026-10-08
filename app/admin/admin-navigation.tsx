"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin/cards", label: "Mise en ligne des cartes" },
  { href: "/admin/players", label: "Administration des joueurs" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l’administration" className="yk-tabs">
      {items.map((item) => (
        <Link
          aria-current={pathname.startsWith(item.href) ? "page" : undefined}
          className="yk-tab"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
