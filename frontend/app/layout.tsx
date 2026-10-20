import type { Metadata, Viewport } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { ConfirmProvider, TooltipProvider } from "@/components/ui/overlay";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "SOC USF",
  icons: { icon: "/favicon.svg" },
  description: "UC Factory SOC : détections par client, journalisation, règles par SIEM / XDR et couverture MITRE ATT&CK.",
};
export const viewport: Viewport = { themeColor: "#090e1b" };

// Applique le thème enregistré avant l'affichage pour éviter un flash.
const themeScript = `try{var t=localStorage.getItem("socusf.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <AuthProvider>
          <WorkspaceProvider>
            <TooltipProvider>
              <ConfirmProvider>
                <Shell>{children}</Shell>
                <Toaster position="bottom-right" theme="system" toastOptions={{ style: { background: "var(--panel)", border: "1px solid var(--line)", color: "var(--fg)" } }} />
              </ConfirmProvider>
            </TooltipProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
