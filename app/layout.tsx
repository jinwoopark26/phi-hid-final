import type { Metadata } from "next";
export const metadata: Metadata = { title: "Lock & Edit", description: "AI에게 받은 글, 필요한 부분만 고치기" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="ko"><body style={{ margin: 0 }}>{children}</body></html>);
}
