// Reglas del contenido premium. Son funciones puras: no tocan la base ni el reloj.

// Cuántas páginas de una edición premium ve quien no tiene suscripción.
export const PREVIEW_PAGES = 3;

// El premium vale hasta el instante de vencimiento; desde ahí ya no.
export function isPremium(
  premiumUntil: Date | null | undefined,
  now: Date,
): boolean {
  return !!premiumUntil && now.getTime() < premiumUntil.getTime();
}

export interface VisiblePages<T> {
  pages: T[];
  // true si la edición es premium y quien lee no lo es.
  locked: boolean;
  totalPages: number;
}

export function pagesVisibleTo<T>(
  pages: readonly T[],
  access: { editionIsPremium: boolean; readerIsPremium: boolean },
): VisiblePages<T> {
  const locked = access.editionIsPremium && !access.readerIsPremium;

  return {
    pages: locked ? pages.slice(0, PREVIEW_PAGES) : [...pages],
    locked,
    totalPages: pages.length,
  };
}