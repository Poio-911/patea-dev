import type { ReactNode } from 'react';

/**
 * Contacto para consultas de privacidad y denuncias. Mientras no haya una
 * casilla definida no se muestra ninguna: no se inventa una dirección.
 */
export const LEGAL_CONTACT_EMAIL: string | null = null;

export const LEGAL_UPDATED_AT = '22 de noviembre de 2026';

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-10 text-[15px] leading-relaxed text-foreground">
      <h1 className="mb-1 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mb-8 text-sm text-muted-foreground">Última actualización: {LEGAL_UPDATED_AT}</p>
      <div className="space-y-6 [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
      </div>
    </main>
  );
}

export function ContactLine() {
  if (!LEGAL_CONTACT_EMAIL) {
    return <p>Para consultas sobre tus datos, usá la opción de soporte dentro de la app.</p>;
  }
  return (
    <p>
      Escribinos a <a className="underline" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
    </p>
  );
}
