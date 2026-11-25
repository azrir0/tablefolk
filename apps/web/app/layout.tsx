import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "TableFolk — Virtual Board Game Café",
  description:
    "Meet friends in a cozy top-down virtual board game café, customize your character, grab a box from the wardrobe, and play multiplayer tabletop games like Treasure Trails.",
  appleWebApp: {
    capable: true,
    title: "TableFolk",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FAF4EA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="min-h-screen bg-oat-100 text-espresso antialiased selection:bg-sage-300/40">
        {children}
      </body>
    </html>
  );
}
