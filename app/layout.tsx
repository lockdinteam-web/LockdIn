import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { TasksProvider } from "@/components/TasksProvider";
import { StudyPlanProvider } from "@/components/StudyPlanProvider";
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
          <StudyPlanProvider>{children}</StudyPlanProvider>
        </TasksProvider>
        <Analytics />
      </body>
    </html>
  );
}