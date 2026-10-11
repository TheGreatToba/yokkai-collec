"use client";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main
      id="main-content"
      style={{
        maxWidth: 560,
        margin: "4rem auto",
        padding: "0 1.5rem",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h1>Impossible d’afficher cette page</h1>
      <p role="alert">Une erreur est survenue. Vous pouvez réessayer.</p>
      <button
        type="button"
        onClick={retry}
        style={{
          padding: "0.75rem 1rem",
          border: "1px solid currentColor",
          borderRadius: 8,
          background: "transparent",
          color: "inherit",
          cursor: "pointer"
        }}
      >
        Réessayer
      </button>
    </main>
  );
}
