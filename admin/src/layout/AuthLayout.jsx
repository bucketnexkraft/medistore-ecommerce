import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ToastContainer } from 'react-toastify';

export default function AuthLayout() {
    const location = useLocation();
    const accessToken = useSelector((state) => state.auth.accessToken);
    const needsPlanSelection = useSelector((state) => state.auth.needs_plan_selection);
    const pricingPath = "/subscription/plans";

    if (accessToken) {
        const redirectTarget = needsPlanSelection
            ? pricingPath
            : "/dashboard";
        return <Navigate to={redirectTarget} replace state={{ from: location }} />;
    }

    return (
        <div className="min-h-screen relative overflow-hidden bg-slate-100">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(37,99,235,0.12),transparent_30%),radial-gradient(circle_at_90%_0%,rgba(244,63,94,0.08),transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]" />
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-pink-500" />
            <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-8">
                <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)] p-5 md:p-9">
                    <Outlet />
                </div>
            </div>
            <ToastContainer />
        </div>
    );
}
