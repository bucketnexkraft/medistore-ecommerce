export const AUTH_TOKEN_STORAGE_KEY = "arcade-auth-token";
export const AUTH_USER_STORAGE_KEY = "arcade-auth-user";
export const AUTH_ROLE_NAME_STORAGE_KEY = "arcade-auth-role-name";

export type AuthUser = {
	id: number | string;
	first_name?: string | null;
	last_name?: string | null;
	email?: string | null;
	phone?: string | null;
	role?: number | string | null;
	profile_image?: string | null;
	company_id?: string | null;
	wallet_balance?: number | string | null;
	total_reword?: number | string | null;
};

export type AuthResponsePayload = {
	token: string;
	user: AuthUser;
	role_name?: string | null;
};

export const normalizeAuthToken = (value?: unknown) => {
	const token = String(value ?? "").trim();

	if (!token) {
		return null;
	}

	return token.replace(/^Bearer\s+/i, "").trim() || null;
};

export const ECOMMERCE_DASHBOARD_PATH = "/user-dashboard";
export const LEGACY_SELLER_DASHBOARD_PATH = "/seller-dashboard";

export const normalizeAuthRedirectPath = (redirectPath?: string | null) => {
	const normalizedPath = String(redirectPath || "").trim();

	if (!normalizedPath || !normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
		return ECOMMERCE_DASHBOARD_PATH;
	}

	if (
		normalizedPath === LEGACY_SELLER_DASHBOARD_PATH ||
		normalizedPath.startsWith(`${LEGACY_SELLER_DASHBOARD_PATH}/`)
	) {
		return ECOMMERCE_DASHBOARD_PATH;
	}

	return normalizedPath;
};

export const getAuthHeaders = (token?: string | null) => {
	const headers: Record<string, string> = {
		Accept: "application/json",
		"Content-Type": "application/json",
	};
	const normalizedToken = normalizeAuthToken(token);

	if (normalizedToken) {
		headers.Authorization = `Bearer ${normalizedToken}`;
	}

	return headers;
};

export const readStoredAuthToken = () => {
	if (typeof window === "undefined") {
		return null;
	}

	return normalizeAuthToken(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
};

export const readStoredAuthUser = () => {
	if (typeof window === "undefined") {
		return null;
	}

	const storedUser = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
	if (!storedUser) {
		return null;
	}

	try {
		return JSON.parse(storedUser) as AuthUser;
	} catch {
		return null;
	}
};

export const getDashboardPath = (
	roleOrUser?: number | string | AuthUser | null,
	companyId?: string | null,
) => {
	void roleOrUser;
	void companyId;

	return ECOMMERCE_DASHBOARD_PATH;
};

export const getUserDisplayName = (user?: AuthUser | null) => {
	if (!user) {
		return "Guest User";
	}

	return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.email || user.phone || "Guest User";
};

export const getUserInitials = (user?: AuthUser | null) => {
	const name = getUserDisplayName(user);
	const initials = name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part.charAt(0).toUpperCase())
		.join("");

	return initials || "GU";
};

export const extractApiError = (payload: unknown, fallbackMessage: string) => {
	if (!payload || typeof payload !== "object") {
		return fallbackMessage;
	}

	const data = payload as {
		message?: string;
		errors?: string[] | Record<string, string[] | string>;
	};

	if (Array.isArray(data.errors) && data.errors.length > 0) {
		return String(data.errors[0]);
	}

	if (data.errors && typeof data.errors === "object") {
		const firstEntry = Object.values(data.errors)[0];
		if (Array.isArray(firstEntry) && firstEntry.length > 0) {
			return String(firstEntry[0]);
		}
		if (typeof firstEntry === "string" && firstEntry.trim()) {
			return firstEntry;
		}
	}

	if (typeof data.message === "string" && data.message.trim()) {
		return data.message;
	}

	return fallbackMessage;
};
