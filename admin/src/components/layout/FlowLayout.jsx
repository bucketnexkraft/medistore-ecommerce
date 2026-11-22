import { Outlet } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import { removeLandingThemeAssets } from "../../hooks/useLandingThemeAssets";
import { useEffect } from "react";

export default function FlowLayout() {
  useEffect(() => {
    removeLandingThemeAssets();
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <Outlet />
      <ToastContainer style={{ zIndex: 9999 }} />
    </div>
  );
}
