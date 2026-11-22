import React, { useEffect, useState } from "react";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";
import { Outlet, useLocation } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { removeLandingThemeAssets } from "../hooks/useLandingThemeAssets";

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const isInBackoffice = location.pathname.startsWith('/backoffice');

  useEffect(() => {
    removeLandingThemeAssets();
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  if (isInBackoffice) {
    return <Outlet />;
  }

  return (
    <div className="h-screen h-dvh min-h-0 overflow-hidden flex flex-col bg-slate-50">
      {/* Navbar */}
      <div className="relative z-40">
        <Navbar toggleSidebar={toggleSidebar} isSidebarOpen={isSidebarOpen} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden pt-16">
        <Sidebar isSidebarOpen={isSidebarOpen} />
        <main
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50 p-3 lg:p-5 transition-all duration-300"
          data-lenis-prevent-wheel
        >
          <Outlet />
        </main>
      </div>
      <ToastContainer style={{ zIndex: 9999 }} />
    </div>
  );
}
