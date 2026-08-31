import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edge Cloud Detect",
  icons: "/b_edge_cloud.svg",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        {/* อ่านค่าที่เลือกไว้ก่อน paint — ไม่งั้นจอกระพริบสว่างก่อนเปลี่ยนเป็นมืด */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.theme||''}catch{}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
