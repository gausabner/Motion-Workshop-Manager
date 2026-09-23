import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "MOTION - Workshop Manager",
  description: "Enterprise Workshop Management SaaS",
};

/**
 * What the phone itself needs to know.
 *
 * `viewportFit: "cover"` lets the page run under the notch and the home
 * indicator, which is the half that makes `env(safe-area-inset-*)` return
 * anything at all — without it those values are 0 and every safe-area padding
 * in the app silently does nothing.
 *
 * `interactiveWidget: "resizes-content"` makes Android's keyboard shrink the
 * layout rather than slide it, so a bottom bar and a `100dvh` shell behave the
 * way they already do on iOS.
 *
 * One `themeColor`, not a pair, because MOTION renders light everywhere today:
 * the dark tokens exist in globals.css but nothing switches to them. White is
 * the colour at the very top of the signed-in app, so the status bar matches
 * the header rather than the brand. A dark value here would put a dark bar
 * above a white page on any phone set to dark mode — exactly the mismatch it
 * is meant to prevent. `colorScheme: "light"` stops the browser darkening form
 * controls and scrollbars on those phones for the same reason.
 *
 * When real dark support lands, this becomes a pair keyed on
 * prefers-color-scheme, and the floor app's own dark header is already handled
 * by the manifest.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
