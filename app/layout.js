import "./globals.css";

export const metadata = {
  title: "Hill Solution — Qualité Bureau d'Études",
  description: "Suivi de production et qualité du bureau d'études Hill Solution",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
