import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NextLevel | Performance Studio",
  description:
    "Turn coach feedback into clearer player development with NextLevel's performance analysis studio.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
