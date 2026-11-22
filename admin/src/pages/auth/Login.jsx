import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useForm } from "react-hook-form";
import { fetchPreferences } from "../../slice/preferencesSlice";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { loginUser, setAuthSession } from "../../slice/authSlice";
import { setRights } from "../../slice/rightSlice";
import { toast } from "react-toastify";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BackendNotInstalled from "../../components/common/BackendNotInstalled";
import { API_URL } from "../../config/constants";

import { shouldShowPlanJourney } from '../../utils/userJourney';
import { getCompanyLandingPath } from '../../utils/companyLanding';

const getPostLoginRedirectPath = (payload) => {
  if (payload?.needs_plan_selection) return "/plans";
  const rights = Array.isArray(payload?.rights) ? payload.rights : [];
  const isSuperAdmin = Number(payload?.user?.is_super_admin ?? payload?.is_super_admin ?? 0) === 1;
  if (isSuperAdmin) return "/backoffice/dashboard";

  if (shouldShowPlanJourney(payload)) return '/user-journey';

  return getCompanyLandingPath(rights, payload?.active_feature_codes);
};

const extractLoginErrorMessage = (payload) => {
  const source = payload?.msg ?? payload?.errors ?? payload?.message;
  if (!source) return null;
  if (typeof source === "string") return source;
  if (Array.isArray(source)) return source.join("\n");
  if (typeof source === "object") {
    const messages = Object.values(source).flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return [value];
      return [];
    });
    return messages.length ? messages.join("\n") : null;
  }
  return null;
};

function Login() {
  const dispatch = useDispatch();
  const { data } = useSelector((state) => state.preferences);
  const companyId = useSelector((state) => state.auth.company_id);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [backendNotInstalled, setBackendNotInstalled] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");
  const pricingPath = "/subscription/plans";

  const onSubmit = async (formData) => {
    const resultAction = await dispatch(loginUser(formData));
    const payload = resultAction?.payload || {};
    const queryRedirect = new URLSearchParams(location.search).get("redirect");
    const safeRedirect =
      queryRedirect && queryRedirect.startsWith("/") && !queryRedirect.startsWith("//")
        ? queryRedirect
        : null;

    const isBackendNotInstalled =
      payload?.http_status === 503 && payload?.code === "BACKEND_NOT_INSTALLED";
    if (isBackendNotInstalled) {
      setBackendNotInstalled(true);
      return;
    }

    if (payload.status === 1) {
      setBackendNotInstalled(false);
      dispatch(setRights(payload?.rights || []));
      toast.success("Login successful");
      if (payload?.needs_plan_selection) {
        navigate(safeRedirect || pricingPath, { replace: true });
        return;
      }
      const postLoginPath = getPostLoginRedirectPath(payload);
      navigate(postLoginPath === '/user-journey' ? postLoginPath : safeRedirect || postLoginPath, { replace: true });
      return;
    }
    const errorMsg = extractLoginErrorMessage(payload);
    toast.error(errorMsg || "Login failed. Please check your credentials.");
  };

  useEffect(() => {
    dispatch(fetchPreferences());
  }, [dispatch]);

  useEffect(() => {
    const transferCode = new URLSearchParams(location.search).get("transfer_code");

    if (!transferCode) {
      return;
    }

    let active = true;

    const consumeTransferCode = async () => {
      setTransferLoading(true);
      setTransferError("");

      try {
        const response = await fetch(`${API_URL}/auth/admin-transfer/consume`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transfer_code: transferCode }),
        });

        const payload = await response.json().catch(() => null);

        const isBackendNotInstalled =
          response.status === 503 && payload?.code === "BACKEND_NOT_INSTALLED";

        if (isBackendNotInstalled) {
          setBackendNotInstalled(true);
          return;
        }

        if (!response.ok || !payload?.status) {
          const errorMessage = extractLoginErrorMessage(payload) || "Admin login transfer failed.";
          throw new Error(errorMessage);
        }

        if (!active) {
          return;
        }

        dispatch(setAuthSession(payload));
        dispatch(setRights(payload?.rights || []));
        toast.success("Login successful");
        navigate(getPostLoginRedirectPath(payload), { replace: true });
      } catch (error) {
        if (!active) {
          return;
        }

        setTransferError(error instanceof Error ? error.message : "Admin login transfer failed.");
      } finally {
        if (active) {
          setTransferLoading(false);
        }
      }
    };

    void consumeTransferCode();

    return () => {
      active = false;
    };
  }, [dispatch, location.search, navigate]);

  const appName = companyId
    ? data?.application_name || data?.basic?.sitename || data?.sitename || "Stoqio"
    : data?.basic?.sitename || data?.sitename || "Stoqio";

  if (backendNotInstalled) {
    return <BackendNotInstalled />;
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="text-center mb-7">
        <p className="text-xs tracking-[0.16em] uppercase text-indigo-600 font-semibold">Welcome Back</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Sign in to {appName}</h2>
        <p className="text-slate-500 mt-2">Access your business dashboard securely and continue managing daily operations.</p>
      </div>

      {transferLoading ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700 mb-4">
          Completing admin handoff...
        </div>
      ) : null}

      {transferError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
          {transferError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="identifier" className="block text-sm font-semibold text-slate-700 mb-2">Work Email or Mobile Number</label>
          <input
            type="text"
            id="identifier"
            {...register("identifier", {
              required: "Email or phone is required",
              setValueAs: (value) => String(value || "").trim(),
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$|^(?:\+?8801|01|1)\d{9}$/,
                message: "Enter a valid email or phone number",
              },
            })}
          className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition ${errors.identifier ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
            placeholder="name@company.com or +8801XXXXXXXXX"
          />
          {errors.identifier && <p className="text-red-500 text-sm mt-1">{errors.identifier.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
          <div className="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              id="password"
              {...register("password", { required: "Password is required" })}
              className={`w-full rounded-xl border bg-white px-4 py-3 pr-11 outline-none transition ${errors.password ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
              placeholder="Enter your account password"
            />
            <button
              type="button"
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-600"
            >
              {passwordVisible ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center text-sm text-slate-600">
            <input type="checkbox" {...register("rememberMe")} className="mr-2 accent-indigo-600" />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">Forgot password?</Link>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-pink-700 transition"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}

export default Login;
