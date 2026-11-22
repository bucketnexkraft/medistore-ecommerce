"use client";

import { apiFetch } from "@/lib/api-client";
import {
	AUTH_ROLE_NAME_STORAGE_KEY,
	AUTH_TOKEN_STORAGE_KEY,
	AUTH_USER_STORAGE_KEY,
	type AuthResponsePayload,
	type AuthUser,
	getAuthHeaders,
	normalizeAuthToken,
	readStoredAuthToken,
	readStoredAuthUser,
} from "@/lib/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type AuthContextValue = {
	user: AuthUser | null;
	token: string | null;
	roleName: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	setAuthSession: (payload: AuthResponsePayload) => void;
	clearAuthSession: (expectedToken?: string | null) => void;
	refreshSession: () => Promise<void>;
	logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_REFRESH_TTL_MS = 60_000;

const isUnauthorizedAuthResponse = (response: Response, payload: unknown) => {
	if (response.status === 401 || response.status === 403) {
		return true;
	}

	if (!payload || typeof payload !== "object") {
		return false;
	}

	const message = "message" in payload ? payload.message : null;
	return typeof message === "string" && message.toLowerCase().includes("unauthenticated");
};

export function AuthProvider({ children }: { children: ReactNode }) {
	const authOperationRef = useRef(0);
	const initialStoredUser = readStoredAuthUser();
	const initialStoredToken = readStoredAuthToken();
	const refreshPromiseRef = useRef<Promise<void> | null>(null);
	const refreshPromiseTokenRef = useRef<string | null>(null);
	const lastRefreshTokenRef = useRef<string | null>(null);
	const lastRefreshAtRef = useRef(0);

	const [user, setUser] = useState<AuthUser | null>(initialStoredUser);
	const [token, setToken] = useState<string | null>(initialStoredToken);
	const [roleName, setRoleName] = useState<string | null>(() => {
		if (typeof window === "undefined") {
			return null;
		}

		return window.localStorage.getItem(AUTH_ROLE_NAME_STORAGE_KEY);
	});
	const [isLoading, setIsLoading] = useState(() => Boolean(initialStoredToken));

	const clearAuthSession = useCallback((expectedToken?: string | null) => {
		if (typeof expectedToken !== "undefined" && readStoredAuthToken() !== normalizeAuthToken(expectedToken)) {
			return;
		}

		authOperationRef.current += 1;
		refreshPromiseRef.current = null;
		refreshPromiseTokenRef.current = null;
		lastRefreshTokenRef.current = null;
		lastRefreshAtRef.current = 0;
		setUser(null);
		setToken(null);
		setRoleName(null);
		setIsLoading(false);

		if (typeof window !== "undefined") {
			window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
			window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
			window.localStorage.removeItem(AUTH_ROLE_NAME_STORAGE_KEY);
		}
	}, []);

	const setAuthSession = useCallback((payload: AuthResponsePayload) => {
		const normalizedToken = normalizeAuthToken(payload.token);

		if (!normalizedToken) {
			clearAuthSession();
			return;
		}

		authOperationRef.current += 1;
		refreshPromiseRef.current = null;
		refreshPromiseTokenRef.current = null;
		lastRefreshTokenRef.current = normalizedToken;
		lastRefreshAtRef.current = Date.now();
		setUser(payload.user);
		setToken(normalizedToken);
		setRoleName(payload.role_name || null);
		setIsLoading(false);

		if (typeof window !== "undefined") {
			window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalizedToken);
			window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(payload.user));
			window.localStorage.setItem(AUTH_ROLE_NAME_STORAGE_KEY, payload.role_name || "");
		}
	}, [clearAuthSession]);

	const refreshSession = useCallback(async () => {
		if (typeof window === "undefined") {
			return;
		}

		const storedToken = readStoredAuthToken();
		const storedRoleName = window.localStorage.getItem(AUTH_ROLE_NAME_STORAGE_KEY);
		const storedUser = readStoredAuthUser();

		if (!storedToken) {
			const operationId = ++authOperationRef.current;
			const isCurrentOperation = () =>
				authOperationRef.current === operationId && readStoredAuthToken() === storedToken;

			if (isCurrentOperation()) {
				clearAuthSession();
			}
			return;
		}

		if (
			refreshPromiseRef.current
			&& refreshPromiseTokenRef.current === storedToken
		) {
			return refreshPromiseRef.current;
		}

		if (
			lastRefreshTokenRef.current === storedToken
			&& Date.now() - lastRefreshAtRef.current < SESSION_REFRESH_TTL_MS
		) {
			setToken(storedToken);
			setUser(storedUser);
			setRoleName(storedRoleName || null);
			setIsLoading(false);
			return;
		}

		const operationId = ++authOperationRef.current;
		const isCurrentOperation = () =>
			authOperationRef.current === operationId && readStoredAuthToken() === storedToken;

		setToken(storedToken);
		setUser(storedUser);
		setRoleName(storedRoleName || null);
		setIsLoading(true);

		const refreshPromise = (async () => {
			const response = await apiFetch("/verify-token", {
				method: "POST",
				headers: getAuthHeaders(storedToken),
			});
			const result = await response.json().catch(() => null);

			if (!isCurrentOperation()) {
				return;
			}

			if (isUnauthorizedAuthResponse(response, result)) {
				clearAuthSession();
				return;
			}

			if (!response.ok) {
				return;
			}

			if (result?.status === 1 && result?.user) {
				setUser(result.user);
				setRoleName(result.role_name || storedRoleName || null);
				window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(result.user));
				window.localStorage.setItem(AUTH_ROLE_NAME_STORAGE_KEY, result.role_name || storedRoleName || "");
				lastRefreshTokenRef.current = storedToken;
				lastRefreshAtRef.current = Date.now();
				return;
			}
		})()
			.catch(() => {
			})
			.finally(() => {
				if (refreshPromiseRef.current === refreshPromise) {
					refreshPromiseRef.current = null;
					refreshPromiseTokenRef.current = null;
				}

				if (isCurrentOperation()) {
					setIsLoading(false);
				}
			});

		refreshPromiseRef.current = refreshPromise;
		refreshPromiseTokenRef.current = storedToken;

		return refreshPromise;
	}, [clearAuthSession]);

	const logout = useCallback(async () => {
		const activeToken = token || (typeof window !== "undefined" ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null);

		try {
			if (activeToken) {
				await apiFetch("/logout", {
					method: "POST",
					headers: getAuthHeaders(activeToken),
				});
			}
		} catch {
		} finally {
			clearAuthSession();
		}
	}, [clearAuthSession, token]);

	useEffect(() => {
		void refreshSession();
	}, [refreshSession]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			token,
			roleName,
			isAuthenticated: Boolean(token && user),
			isLoading,
			setAuthSession,
			clearAuthSession,
			refreshSession,
			logout,
		}),
		[user, token, roleName, isLoading, setAuthSession, clearAuthSession, refreshSession, logout],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider");
	}

	return context;
}
