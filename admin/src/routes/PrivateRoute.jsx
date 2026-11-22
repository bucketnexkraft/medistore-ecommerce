import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { API_URL } from "../config/constants";
import { toast } from "react-toastify";
import Spiner from "../components/loadings/Spiner";
import { fetchRight } from "../slice/rightSlice";
import { useDispatch } from "react-redux";
import { logout, setPlanAccess } from "../slice/authSlice";
import BackendNotInstalled from "../components/common/BackendNotInstalled";

const normalizePath = (path) => path.replace(/\/+$/, "") || "/";
const extractAuthErrorMessage = (error) => {
  const source = error?.response?.data?.errors || error?.response?.data?.message;

  if (!source) {
    return "Please login first.";
  }

  if (typeof source === "string") {
    return source;
  }

  if (Array.isArray(source)) {
    return source[0] || "Please login first.";
  }

  if (typeof source === "object") {
    const messages = Object.values(source).flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return [value];
      return [];
    });

    return messages[0] || "Please login first.";
  }

  return "Please login first.";
};

const isPlanSelectionPath = (path) => {
  const normalizedPath = normalizePath(path);

  return (
    normalizedPath === "/plans" ||
    normalizedPath.startsWith("/plans/checkout/") ||
    normalizedPath.startsWith("/subscription/") ||
    normalizedPath === "/plan-payments" ||
    normalizedPath === "/logout" ||
    normalizedPath.startsWith("/plans/payment-checkout/")
  );
};

export default function PrivateRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [verifiedNeedsPlanSelection, setVerifiedNeedsPlanSelection] = useState(false);
  const [planAccessResolved, setPlanAccessResolved] = useState(false);
  const [backendNotInstalled, setBackendNotInstalled] = useState(false);
  const location = useLocation();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const hasActivePlan = useSelector((state) => state.auth.has_active_plan);
  const persistedNeedsPlanSelection = useSelector((state) => state.auth.needs_plan_selection);
  const isSuperAdmin = Number(useSelector((state) => state.auth.is_super_admin) || 0) === 1;
  const mustSelectPlan =
    !isSuperAdmin &&
    Boolean(companyId) &&
    (Boolean(persistedNeedsPlanSelection) ||
      verifiedNeedsPlanSelection ||
      (planAccessResolved && !hasActivePlan));
  const planSelectionPath = isPlanSelectionPath(location.pathname);
  const hasVerifiedRef = useRef(false);
  const hasFetchedRightsRef = useRef(false);

  const dispatch = useDispatch();
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (!accessToken) {
          setIsAuthenticated(false);
          setPlanAccessResolved(false);
          setLoading(false);
          return;
        }

        const response = await axios.post(
          API_URL + "/verify-token",
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.data.status && accessToken) {
          setBackendNotInstalled(false);
          setIsAuthenticated(true);
          hasVerifiedRef.current = true;
          const needsPlanSelection = Boolean(response?.data?.needs_plan_selection);
          setVerifiedNeedsPlanSelection(needsPlanSelection);
          setPlanAccessResolved(true);
          dispatch(
            setPlanAccess({
              has_active_plan: Boolean(response?.data?.has_active_plan),
              needs_plan_selection: needsPlanSelection,
              selected_plan_id: response?.data?.selected_plan_id || null,
              selected_plan: response?.data?.selected_plan || null,
              selected_plan_features:
                response?.data?.selected_plan_features ||
                response?.data?.selected_plan?.effective_features || response?.data?.selected_plan?.features || [],
              needs_ecommerce_setup: Boolean(response?.data?.needs_ecommerce_setup),
              selected_e_template_id: response?.data?.selected_e_template_id || null,
              ecommerce_setup_completed_at: response?.data?.ecommerce_setup_completed_at || null,
            })
          );
          if (accessToken && !hasFetchedRightsRef.current) {
            hasFetchedRightsRef.current = true;
            dispatch(fetchRight({ accessToken }));
          }
        } else {
          dispatch(logout());
          setIsAuthenticated(false);
          setPlanAccessResolved(false);
          toast.error("Please login first.", {
            position: "top-right",
            autoClose: 5000,
          });
        }
      } catch (error) {
        const isBackendNotInstalled =
          error?.response?.status === 503 &&
          error?.response?.data?.code === "BACKEND_NOT_INSTALLED";
        const isRateLimited = error?.response?.status === 429;

        if (isBackendNotInstalled) {
          setBackendNotInstalled(true);
        } else if (isRateLimited && hasVerifiedRef.current) {
          setIsAuthenticated(true);
          setPlanAccessResolved(true);
        } else {
          dispatch(logout());
          hasVerifiedRef.current = false;
          hasFetchedRightsRef.current = false;
          setVerifiedNeedsPlanSelection(false);
        }

        if (!isRateLimited || !hasVerifiedRef.current) {
          setIsAuthenticated(false);
          setPlanAccessResolved(false);
        }

        if (!isBackendNotInstalled && !isRateLimited) {
          toast.error(extractAuthErrorMessage(error), {
            position: "top-right",
            autoClose: 5000,
          });
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [accessToken, dispatch]);

  if (loading) {
    return <Spiner />;
  }

  if (backendNotInstalled) {
    return <BackendNotInstalled />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (
    mustSelectPlan &&
    !planSelectionPath
  ) {
    return <Navigate to="/subscription/plans" replace />;
  }

  return children;
}
