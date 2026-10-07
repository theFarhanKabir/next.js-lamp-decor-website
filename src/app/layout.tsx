import type { Metadata } from "next";
import "../styles/index.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Cloud Lamps & Mirrors",
  description:
    "Explore thoughtfully selected lamps, mirrors, shades, and tables from Cloud Lamps & Mirrors.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <div id="root">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
