import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { TasksProvider } from "@/components/TasksProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "LockdIn",
  description: "AI workflow and performance app for university students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TasksProvider>
          {children}
        </TasksProvider>
        <Analytics />
      </body>
    </html>
  );
}