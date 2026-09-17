import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "V2 DEX",
  description: "Local Uniswap-V2-style DEX demo"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}