"use client";

import ErrorPage from "@/app/error";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#0c1017", color: "#fff" }}>
        <title>Page indisponible — Yokkai Collec’</title>
        <ErrorPage retry={retry} />
      </body>
    </html>
  );
}
