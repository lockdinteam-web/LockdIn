import Sidebar from "./Sidebar";

type AppShellProps = {
  children: React.ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen overflow-x-hidden bg-slate-950">
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}