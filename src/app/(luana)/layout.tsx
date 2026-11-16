import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Luana",
  description: "Mande a fatura ou o print das compras e veja seus gastos por categoria, juros, IOF e onde economizar.",
};

/** Lê tema e cor guardados no navegador e marca o <html>, para a tela não piscar na cor errada. */
const APLICAR_PREFERENCIAS = `try{var d=document.documentElement,t=localStorage.getItem("luana-tema"),c=localStorage.getItem("luana-cor");if(t)d.dataset.tema=t;if(c)d.dataset.cor=c}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // O script abaixo aplica tema e cor antes da primeira pintura.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APLICAR_PREFERENCIAS }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
