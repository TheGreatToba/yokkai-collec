"use client";

import ErrorPage from "@/app/error";

export default function GlobalError({ retry }: { retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0c1017", color: "#fff" }}>
        <title>Page unavailable — Yokkai Collec’</title>
        <ErrorPage retry={retry} />
      </body>
    </html>
  );
}
