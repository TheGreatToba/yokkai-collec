import { YokaiCard } from "@/components/yokai-card";

const samples = [
  {
    name: "SAM",
    rarity: "C" as const,
    file: "5a85f6d10ebfb4a4895ecfae4d729bc0e57b12dfc96daae91d92f93571e9b559"
  },
  {
    name: "BTS",
    rarity: "LR" as const,
    file: "a2af29d706f2afb1db9ab31b100ef8d3c0450ccca1d8c775d54514f393c02048-678d3b22128b7404"
  }
];

export default async function ImageQualityProof({
  searchParams
}: {
  searchParams: Promise<{ device?: string; view?: string }>;
}) {
  const params = await searchParams;
  const mobile = params.device === "mobile";
  const detail = params.view === "detail";
  const density = mobile ? 3 : 1;
  const width = detail ? (mobile ? 330 : 340) : mobile ? 170 : 200;
  const requested = (mobile ? 390 * 0.45 : 200) * density;
  const previousWidth = [
    32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840
  ].find(value => value >= requested)!;
  return (
    <main style={{ padding: 24, width: "max-content" }}>
      <h1>
        Images · {mobile ? "Mobile : raster 3× (390 px CSS)" : "Desktop 1×"} ·{" "}
        {detail ? "Détail" : "Grille"}
      </h1>
      <p>
        Comparaison à la même taille physique. Mobile : reconstruction du rendu
        3×, pas émulation du DPR du navigateur.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(3, ${width * density}px)`,
          gap: 24
        }}
      >
        {[
          "Avant #139 · originale",
          "Actuel · qualité 75",
          "Après · qualité 85 / originale"
        ].map((title, index) => (
          <section key={title}>
            <h2 style={{ fontSize: 18, margin: "20px 0", height: 48 }}>
              {title}
            </h2>
            {samples.map(sample => {
              const original = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/card-images/${sample.file}`;
              const source =
                index === 1
                  ? `/_next/image?url=${encodeURIComponent(original)}&w=${previousWidth}&q=75`
                  : original;
              return (
                <div
                  key={sample.file}
                  data-proof={`${index}-${sample.rarity}`}
                  style={{ width: width * density, marginBottom: 24 }}
                >
                  <YokaiCard
                    {...sample}
                    image={source}
                    category="ANIME/MANGA"
                    animated={false}
                    imageSizes={
                      index === 2 && !detail
                        ? mobile
                          ? "1170px"
                          : "100vw"
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </main>
  );
}
