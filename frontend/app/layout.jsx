import "./globals.css";

export const metadata = {
  title: "OpsLens MCP: Multi-Agent Industrial RCA",
  description:
    "Auditable, multi-agent root-cause analysis built on Anthropic's Model Context Protocol.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
