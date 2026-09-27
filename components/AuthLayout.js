/** Mise en page commune des écrans Connexion et « Qui es-tu ? ». */
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* Panneau de marque */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-brand-700 text-white p-12">
        <svg
          className="absolute inset-x-0 bottom-0 w-full h-2/3 text-white/[0.06]"
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d="M0 400 L150 170 L230 260 L340 90 L450 230 L520 160 L600 250 L600 400 Z" fill="currentColor" />
          <path d="M0 400 L110 260 L200 330 L320 200 L430 320 L600 220 L600 400 Z" fill="currentColor" />
        </svg>
        <div className="relative">
          <div className="inline-flex items-center rounded-2xl bg-white px-4 py-3 shadow-pop">
            <img src="/logo-hillsolution-h.png" alt="Hill Solution" className="h-12 w-auto" />
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="text-brand-200 text-sm font-semibold uppercase tracking-wider mb-3">Bureau d'études</p>
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            Production &amp; qualité, suivies au même endroit.
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed">
            Dispatching, vérification, retours et statistiques par ingénieur — en temps réel pour toute l'équipe.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} Hill Solution — Tunis</p>
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center px-5 py-10 bg-paper lg:bg-white">
        <div className="w-full max-w-sm">
          <img src="/logo-hillsolution-h.png" alt="Hill Solution" className="h-14 w-auto mx-auto mb-8 lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
