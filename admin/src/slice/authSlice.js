import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { API_URL } from "../config/constants";

// Login API call
const loginApi = async (body) => {
  try {
    const response = await axios.post(API_URL + "/login", body);
    return response.data; // This is where we return the API response.
  } catch (error) {
    const responseData = error?.response?.data || {};
    // Return error response so it can be handled in extraReducers
    return {
      status: 0,
      code: responseData?.code || null,
      http_status: error?.response?.status || null,
      msg: responseData?.errors || responseData?.message || "Login failed",
    };
  }
};

// Async Thunk for login
export const loginUser = createAsyncThunk("auth/loginUser", loginApi);

const buildName = (user = {}) =>
  `${user.first_name || ""} ${user.last_name || ""}`.trim();

const normalizePlanFeatures = (features) =>
  Array.isArray(features)
    ? features.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

const resolveRoleName = (payload = {}, user = {}) =>
  payload.role_name ||
  payload.role ||
  user.role_name ||
  user.roles?.name ||
  "";

const applySession = (state, payload = {}) => {
  const user = payload.user || {};
  state.accessToken = payload.token || "";
  state.id = user.id || "";
  state.name = buildName(user);
  state.email = user.email || "";
  state.profile_image_path = user.profile_image_path || user.profile_image || "";
  state.phone = user.phone || "";
  state.login_provider = payload.login_provider || "";
  state.address = user.address || "";
  state.expires_in = payload.expires_in || "";
  state.company_id = user.company_id || "";
  state.role = user.role || "";
  state.role_name = resolveRoleName(payload, user);
  state.is_super_admin = user.is_super_admin || 0;
  state.printer_type = user.printer_type || "normal";
  state.has_active_plan = Boolean(payload.has_active_plan);
  state.needs_plan_selection = Boolean(payload.needs_plan_selection);
  state.selected_plan_id = payload.selected_plan_id || null;
  state.selected_plan = payload.selected_plan || null;
  state.selected_plan_features = normalizePlanFeatures(
    payload.selected_plan_features || payload.selected_plan?.features || []
  );
  state.needs_ecommerce_setup = Boolean(payload.needs_ecommerce_setup);
  state.selected_e_template_id = payload.selected_e_template_id || null;
  state.ecommerce_setup_completed_at = payload.ecommerce_setup_completed_at || null;
};

const authSlice = createSlice({
  name: "auth",
  initialState: {
    accessToken: "",
    id: "",
    name: "",
    email: "",
    address: "",
    phone: "",
    login_provider: "",
    profile_image_path: "",
    company_id: "",
    role: "",
    role_name: "",
    is_super_admin: 0,
    printer_type: "normal",
    has_active_plan: false,
    needs_plan_selection: false,
    selected_plan_id: null,
    selected_plan: null,
    selected_plan_features: [],
    needs_ecommerce_setup: false,
    selected_e_template_id: null,
    ecommerce_setup_completed_at: null,
    expires_in: "",
    is_impersonating: false,
    impersonator_session: null,
    loading: false,
    error: null,
  },
  reducers: {
    setAccessToken(state, action) {
      state.accessToken = action.payload;
    },
    updateUserInfo(state, action) {
      const { name, email, profile_image_path, is_super_admin, printer_type, role_name } = action.payload;

      if (name) state.name = name;
      if (email) state.email = email;
      if (profile_image_path) state.profile_image_path = profile_image_path;
      if (is_super_admin !== undefined) state.is_super_admin = is_super_admin;
      if (printer_type) state.printer_type = printer_type;
      if (role_name !== undefined) state.role_name = role_name;
    },
    setAuthSession(state, action) {
      applySession(state, action.payload);
      state.error = null;
    },
    setPlanAccess(state, action) {
      const payload = action.payload || {};
      if (typeof payload.has_active_plan === "boolean") {
        state.has_active_plan = payload.has_active_plan;
      }
      if (typeof payload.needs_plan_selection === "boolean") {
        state.needs_plan_selection = payload.needs_plan_selection;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "selected_plan_id")) {
        state.selected_plan_id = payload.selected_plan_id;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "selected_plan")) {
        state.selected_plan = payload.selected_plan || null;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "selected_plan_features")) {
        state.selected_plan_features = normalizePlanFeatures(payload.selected_plan_features);
      } else if (Object.prototype.hasOwnProperty.call(payload, "selected_plan")) {
        state.selected_plan_features = normalizePlanFeatures(payload.selected_plan?.features || []);
      }
      if (typeof payload.needs_ecommerce_setup === "boolean") {
        state.needs_ecommerce_setup = payload.needs_ecommerce_setup;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "selected_e_template_id")) {
        state.selected_e_template_id = payload.selected_e_template_id;
      }
      if (Object.prototype.hasOwnProperty.call(payload, "ecommerce_setup_completed_at")) {
        state.ecommerce_setup_completed_at = payload.ecommerce_setup_completed_at || null;
      }
    },
    startImpersonation(state, action) {
      const { token, user, impersonatorSession } = action.payload || {};
      applySession(state, { token, user });
      state.is_impersonating = true;
      if (!state.impersonator_session) {
        state.impersonator_session = impersonatorSession || null;
      }
      state.error = null;
    },
    stopImpersonation(state, action) {
      const { token, user, authSnapshot } = action.payload || {};
      if (authSnapshot) {
        state.accessToken = authSnapshot.accessToken || "";
        state.id = authSnapshot.id || "";
        state.name = authSnapshot.name || "";
        state.email = authSnapshot.email || "";
        state.address = authSnapshot.address || "";
        state.phone = authSnapshot.phone || "";
        state.login_provider = authSnapshot.login_provider || "";
        state.profile_image_path = authSnapshot.profile_image_path || "";
        state.company_id = authSnapshot.company_id || "";
        state.role = authSnapshot.role || "";
        state.role_name = authSnapshot.role_name || "";
        state.is_super_admin = authSnapshot.is_super_admin || 0;
        state.printer_type = authSnapshot.printer_type || "normal";
        state.expires_in = authSnapshot.expires_in || "";
        state.selected_plan = authSnapshot.selected_plan || null;
        state.selected_plan_features = normalizePlanFeatures(
          authSnapshot.selected_plan_features || authSnapshot.selected_plan?.features || []
        );
        state.needs_ecommerce_setup = Boolean(authSnapshot.needs_ecommerce_setup);
        state.selected_e_template_id = authSnapshot.selected_e_template_id || null;
        state.ecommerce_setup_completed_at = authSnapshot.ecommerce_setup_completed_at || null;
      } else {
        applySession(state, { token, user });
      }
      state.is_impersonating = false;
      state.impersonator_session = null;
      state.error = null;
    },
    logout(state) {
      // Reset the state to initial values
      state.accessToken = "";
      state.id = "";
      state.name = "";
      state.email = "";
      state.address = "";
      state.phone = "";
      state.login_provider = "";
      state.profile_image_path = "";
      state.printer_type = "normal";
      state.expires_in = "";
      state.company_id = "";
      state.role = "";
      state.role_name = "";
      state.is_super_admin = 0;
      state.is_impersonating = false;
      state.impersonator_session = null;
      state.has_active_plan = false;
      state.needs_plan_selection = false;
      state.selected_plan_id = null;
      state.selected_plan = null;
      state.selected_plan_features = [];
      state.needs_ecommerce_setup = false;
      state.selected_e_template_id = null;
      state.ecommerce_setup_completed_at = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;

        // Check if login was successful (status === 1)
        if (action.payload.status === 1) {
          applySession(state, action.payload);
          state.is_impersonating = false;
          state.impersonator_session = null;
          state.error = null;
        } else {
          state.error = action.payload.msg;
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const selectAccessToken = (state) => state.auth.accessToken;

export const {
  setAccessToken,
  updateUserInfo,
  setAuthSession,
  setPlanAccess,
  startImpersonation,
  stopImpersonation,
  logout,
} = authSlice.actions;
export default authSlice.reducer;
