import { Skeleton } from "@/components/ui";

export default function Loading() {
  return <main id="main-content" className="yk-route-loading" aria-label="Chargement de la page">
    <Skeleton className="h-3 w-32" label="Chargement du contexte" />
    <Skeleton className="mt-4 h-10 w-full max-w-md" label="Chargement du titre" />
    <Skeleton className="mt-8 h-12 w-full" label="Chargement des commandes" />
    <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="aspect-[5/7] w-full" label="Chargement du contenu" />)}
    </div>
  </main>;
}
