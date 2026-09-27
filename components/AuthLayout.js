/** Mise en page commune des écrans Connexion et « Qui es-tu ? » : grand logo à gauche, formulaire à droite. */
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panneau de marque : le logo seul */}
      <aside className="hidden lg:flex items-center justify-center bg-white border-r border-line p-12">
        <img src="/logo-hillsolution-h.png" alt="Hill Solution" className="w-full max-w-[440px] h-auto" />
      </aside>

      {/* Formulaire */}
      <main className="flex items-center justify-center px-5 py-10 bg-paper">
        <div className="w-full max-w-sm">
          <img src="/logo-hillsolution-h.png" alt="Hill Solution" className="h-20 w-auto mx-auto mb-8 lg:hidden" />
          <div className="card p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
