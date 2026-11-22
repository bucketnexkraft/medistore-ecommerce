"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { UserDashTitle } from "@/components/user-dashboard/common/UserDashTitle";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";

type NewsletterRow = {
	id: number;
	email: string;
	company_id?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
};

type NewsletterMeta = {
	current_page?: number;
	per_page?: number;
	total?: number;
	last_page?: number;
};

const formatDate = (value?: string | null) => {
	if (!value) {
		return "Recently";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return "Recently";
	}

	return new Intl.DateTimeFormat(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
};

export function Newsletters() {
	const { token, isAuthenticated, isLoading } = useAuth();
	const [rows, setRows] = useState<NewsletterRow[]>([]);
	const [meta, setMeta] = useState<NewsletterMeta>({});
	const [search, setSearch] = useState("");
	const [isFetching, setIsFetching] = useState(true);
	const [isMutatingId, setIsMutatingId] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	const loadRows = async (searchValue = "") => {
		if (!token) {
			setRows([]);
			setMeta({});
			setIsFetching(false);
			return;
		}

		setIsFetching(true);
		setError(null);

		try {
			const query = new URLSearchParams({
				page: "1",
				perPage: "100",
			});

			if (searchValue.trim() !== "") {
				query.set("search", searchValue.trim());
			}

			const response = await apiFetch(`/backoffice/content/newsletters?${query.toString()}`, {
				headers: getAuthHeaders(token),
				cache: "no-store",
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Newsletter subscribers could not be loaded."));
			}

			setRows(Array.isArray(payload?.data) ? (payload.data as NewsletterRow[]) : []);
			setMeta((payload?.meta as NewsletterMeta | undefined) || {});
		} catch (fetchError) {
			setError(fetchError instanceof Error ? fetchError.message : "Newsletter subscribers could not be loaded.");
			setRows([]);
			setMeta({});
		} finally {
			setIsFetching(false);
		}
	};

	useEffect(() => {
		if (isLoading) {
			return;
		}

		if (!isAuthenticated || !token) {
			setRows([]);
			setMeta({});
			setIsFetching(false);
			return;
		}

		void loadRows(search);
	}, [isAuthenticated, isLoading, token]);

	const filteredCountLabel = useMemo(() => {
		const total = Number(meta.total ?? rows.length ?? 0);
		return `${total} subscriber${total === 1 ? "" : "s"}`;
	}, [meta.total, rows.length]);

	const handleSearchSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		await loadRows(search);
	};

	const handleDelete = async (id: number) => {
		if (!token || isMutatingId !== null) {
			return;
		}

		setIsMutatingId(id);

		try {
			const response = await apiFetch(`/backoffice/content/newsletters/${id}`, {
				method: "DELETE",
				headers: getAuthHeaders(token),
			});
			const payload = await response.json().catch(() => null);

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Subscriber could not be removed."));
			}

			setRows((current) => current.filter((row) => row.id !== id));
			setMeta((current) => ({
				...current,
				total: Math.max(Number(current.total ?? rows.length) - 1, 0),
			}));
			toast({
				title: "Subscriber removed",
				description: "The email has been deleted from the newsletter list.",
			});
		} catch (mutationError) {
			toast({
				title: "Delete failed",
				description: mutationError instanceof Error ? mutationError.message : "Subscriber could not be removed.",
			});
		} finally {
			setIsMutatingId(null);
		}
	};

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<UserDashTitle title="Newsletters" subtitle="See who subscribed from your storefront footer form" />
				<Button type="button" variant="outline" className="w-fit border-primary-blue text-primary-blue hover:bg-blue-50" onClick={() => void loadRows(search)}>
					<RefreshCw size={16} />
					Refresh
				</Button>
			</div>

			<div className="rounded-2xl border bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-lg font-semibold text-primary-black">Newsletter Subscribers</p>
						<p className="text-sm text-primary-body">{filteredCountLabel}</p>
					</div>

					<form onSubmit={handleSearchSubmit} className="relative w-full lg:max-w-sm">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-body" />
						<input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Search by email"
							className="h-11 w-full rounded-xl border border-border bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary-blue"
						/>
					</form>
				</div>
			</div>

			{isFetching ? (
				<div className="flex items-center justify-center gap-3 rounded-2xl border bg-white p-10 text-primary-body shadow-sm">
					<Loader2 className="h-5 w-5 animate-spin" />
					Loading newsletter subscribers...
				</div>
			) : error ? (
				<div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
					<p className="text-lg font-semibold text-primary-black">Could not load newsletter subscribers</p>
					<p className="mt-2 text-sm text-primary-body">{error}</p>
				</div>
			) : rows.length === 0 ? (
				<div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
					<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-primary-blue">
						<Mail className="h-6 w-6" />
					</div>
					<p className="mt-4 text-lg font-semibold text-primary-black">No subscribers yet</p>
					<p className="mt-2 text-sm text-primary-body">When customers subscribe from the footer newsletter form, their email will appear here.</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
					<div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-4 border-b bg-slate-50 px-5 py-4 text-sm font-semibold text-primary-black">
						<span>Email</span>
						<span>Subscribed At</span>
						<span>Action</span>
					</div>

					<div className="divide-y">
						{rows.map((row) => {
							const isBusy = isMutatingId === row.id;

							return (
								<div key={row.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-4 px-5 py-4">
									<div className="min-w-0">
										<p className="truncate font-medium text-primary-black">{row.email}</p>
									</div>
									<p className="text-sm text-primary-body">{formatDate(row.created_at)}</p>
									<Button
										type="button"
										variant="outline"
										onClick={() => void handleDelete(row.id)}
										disabled={isBusy}
										className="border-red-200 text-red-600 hover:bg-red-50"
									>
										<Trash2 size={16} />
										{isBusy ? "Removing..." : "Remove"}
									</Button>
								</div>
							);
						})}
					</div>
				</div>
			)}
		</div>
	);
}
