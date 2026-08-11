import "./globals.css";

export const metadata = {
  title: "ISO BAT — Qualité Bureau d'Étude",
  description: "Suivi de production et qualité du bureau d'étude ISO BAT",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
