import { useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function MainLayout({ children, title, subtitle }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar_open");
    if (stored !== null) {
      setSidebarOpen(stored === "true");
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_open", String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={!sidebarOpen} />
      <div className={`transition-[padding] duration-200 ${sidebarOpen ? "pl-64" : "pl-0"}`}>
        <Header title={title} subtitle={subtitle} onToggleSidebar={toggleSidebar} sidebarCollapsed={!sidebarOpen} />
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
