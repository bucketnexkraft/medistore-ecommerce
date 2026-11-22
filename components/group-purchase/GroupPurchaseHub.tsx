"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock3, Copy, MessageCircle, ShoppingBag, Sparkles, Users } from "lucide-react";
import SafeImage from "@/components/common/SafeImage";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/AuthProvider";
import { getAuthHeaders, extractApiError } from "@/lib/auth";
import { apiFetch, buildCompanyScopedApiUrl } from "@/lib/api-client";
import { useAmount } from "@/lib/amount";
import { getRealtimeEcho, getRealtimeSocketId, type RealtimeConfig } from "@/lib/realtime";
import { toast } from "@/hooks/use-toast";

type GroupPurchaseCard = {
	product: {
		id: string;
		name: string;
		slug: string;
		thumbnail: string;
		price: number;
		original_price: number;
		category: { name: string; slug: string } | null;
		brand: string | null;
	};
	group_purchase: {
		is_available: boolean;
		discount_type: "fixed" | "percent";
		discount_amount: number;
		minimum_users: number;
		discount_value: number;
		discounted_price: number;
	};
	active_group: GroupPurchaseDetails | null;
};

type GroupPurchaseMember = {
	id: string;
	joined_at: string | null;
	user: {
		id: string;
		name: string;
		email?: string | null;
		phone?: string | null;
		profile_image?: string | null;
	} | null;
};

type GroupPurchaseMessage = {
	id: string;
	message: string;
	created_at: string | null;
	is_mine: boolean;
	user: {
		id: string;
		name: string;
		profile_image?: string | null;
	} | null;
};

type GroupPurchaseDetails = {
	id: string;
	company_id?: string;
	share_token: string;
	share_path: string;
	status: "open" | "completed" | "cancelled";
	purchase_status?: "awaiting_members" | "awaiting_purchases" | "discount_unlocked" | "discount_failed";
	minimum_users: number;
	joined_count: number;
	remaining_members: number;
	purchase_count?: number;
	remaining_purchases?: number;
	has_purchased?: boolean;
	purchase_order_id?: string | null;
	discount_type: "fixed" | "percent";
	discount_amount: number;
	base_price: number;
	discounted_price: number;
	expires_at: string | null;
	purchase_deadline_at?: string | null;
	discount_unlocked_at?: string | null;
	is_joined: boolean;
	product: {
		id: string;
		name: string;
		slug: string;
		thumbnail: string;
		price: number;
		vat?: number;
		category: { name: string; slug: string } | null;
		brand: string | null;
		group_purchase: {
			is_available: boolean;
			discount_type: "fixed" | "percent";
			discount_amount: number;
			minimum_users: number;
			discount_value: number;
			discounted_price: number;
		};
	} | null;
	owner: {
		id: string;
		name: string;
		profile_image?: string | null;
	} | null;
	realtime?: {
		enabled: boolean;
		key: string;
		cluster: string;
	} | null;
	members?: GroupPurchaseMember[];
	messages?: GroupPurchaseMessage[];
};

const TABS = [
	{ id: "members", label: "Members", icon: Users },
	{ id: "chat", label: "Chat", icon: MessageCircle },
	{ id: "summary", label: "Bag", icon: ShoppingBag },
] as const;

export function GroupPurchaseHub() {
	const { token, isAuthenticated, user } = useAuth();
	const { formatAmount } = useAmount();
	const router = useRouter();
	const searchParams = useSearchParams();
	const [cards, setCards] = useState<GroupPurchaseCard[]>([]);
	const [selectedGroup, setSelectedGroup] = useState<GroupPurchaseDetails | null>(null);
	const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("members");
	const [draftMessage, setDraftMessage] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [realtimeConfig, setRealtimeConfig] = useState<RealtimeConfig | null>(null);
	const attemptedInviteJoinRef = useRef<string | null>(null);
	const lastRealtimeSignalAtRef = useRef<number>(0);

	const selectedGroupId = searchParams.get("group");
	const inviteToken = searchParams.get("invite");
	const selectedProductId = searchParams.get("product");
	const isSelectedGroupFull = selectedGroup ? selectedGroup.joined_count >= selectedGroup.minimum_users : false;
	const canJoinSelectedGroup = Boolean(selectedGroup && !selectedGroup.is_joined && selectedGroup.status === "open" && !isSelectedGroupFull);
	const canViewPrivateGroupArea = Boolean(selectedGroup && isAuthenticated && selectedGroup.is_joined);
	const canCheckoutSelectedGroup = Boolean(
		selectedGroup &&
		selectedGroup.is_joined &&
		selectedGroup.status === "completed" &&
		selectedGroup.purchase_status === "awaiting_purchases" &&
		!selectedGroup.has_purchased,
	);

	const applyGroupUpdate = useCallback((group: GroupPurchaseDetails) => {
		const currentUserId = user?.id ? String(user.id) : null;
		const normalizedGroup: GroupPurchaseDetails = {
			...group,
			is_joined: currentUserId ? (group.members?.some((member) => member.user?.id === currentUserId) ?? group.is_joined) : group.is_joined,
			messages: (group.messages || []).map((message) => ({
				...message,
				is_mine: currentUserId ? message.user?.id === currentUserId : message.is_mine,
			})),
		};

		setSelectedGroup(normalizedGroup);
		setCards((currentCards) =>
			currentCards.map((card) =>
				card.active_group?.id === normalizedGroup.id || card.product.id === normalizedGroup.product?.id
					? { ...card, active_group: normalizedGroup }
					: card,
			),
		);
	}, [user?.id]);

	useEffect(() => {
		const realtime = selectedGroup?.realtime;

		if (!realtime?.enabled || !realtime.key) {
			setRealtimeConfig(null);
			return;
		}

		setRealtimeConfig({
			key: realtime.key,
			cluster: realtime.cluster || "mt1",
			authEndpoint: buildCompanyScopedApiUrl("/broadcasting/auth"),
			token: "",
		});
	}, [selectedGroup?.realtime]);

	useEffect(() => {
		let ignore = false;

		const loadData = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const query = new URLSearchParams();
				query.set("limit", "12");
				if (selectedGroupId) {
					query.set("group", selectedGroupId);
				}

				const response = await apiFetch(`/landing/group-purchases?${query.toString()}`, {
					cache: "no-store",
				});
				const payload = await response.json();

				if (!response.ok || payload?.status !== 1) {
					throw new Error(extractApiError(payload, "Could not load group purchase deals."));
				}

				let resolvedGroup = (payload?.data?.selected_group as GroupPurchaseDetails | null) || null;

				if (!resolvedGroup && inviteToken) {
					const inviteResponse = await apiFetch(`/group-purchases/invitations/${encodeURIComponent(inviteToken)}`, {
						cache: "no-store",
					});
					const invitePayload = await inviteResponse.json();

					if (inviteResponse.ok && invitePayload?.status === 1) {
						resolvedGroup = invitePayload.data as GroupPurchaseDetails;
					}
				}

				if (resolvedGroup?.id && token && isAuthenticated) {
					const authGroupResponse = await apiFetch(`/group-purchases/${encodeURIComponent(resolvedGroup.id)}`, {
						headers: getAuthHeaders(token),
						cache: "no-store",
					});

					if (authGroupResponse.ok) {
						const authGroupPayload = await authGroupResponse.json();
						if (authGroupPayload?.status === 1 && authGroupPayload?.data) {
							resolvedGroup = authGroupPayload.data as GroupPurchaseDetails;
						}
					}
				}

				if (!ignore) {
					setCards(Array.isArray(payload?.data?.cards) ? payload.data.cards : []);
					setSelectedGroup(resolvedGroup);
				}
			} catch (loadError) {
				if (!ignore) {
					setError(loadError instanceof Error ? loadError.message : "Could not load group purchase deals.");
				}
			} finally {
				if (!ignore) {
					setIsLoading(false);
				}
			}
		};

		void loadData();

		return () => {
			ignore = true;
		};
	}, [inviteToken, isAuthenticated, selectedGroupId, token]);

	useEffect(() => {
		if (!selectedGroup?.id || !selectedGroup.is_joined || !token || !isAuthenticated || !realtimeConfig?.key) {
			return;
		}

		lastRealtimeSignalAtRef.current = Date.now();
		const echo = getRealtimeEcho({
			...realtimeConfig,
			token,
		});
		const channelName = `group-purchase.${selectedGroup.id}`;
		const channel = echo.private(channelName);

		channel.listen(".group-purchase.updated", (event: { action?: string; group?: GroupPurchaseDetails }) => {
			if (!event.group) {
				return;
			}

			lastRealtimeSignalAtRef.current = Date.now();
			applyGroupUpdate(event.group);
		});

		return () => {
			echo.leave(channelName);
		};
	}, [applyGroupUpdate, isAuthenticated, realtimeConfig, selectedGroup?.id, selectedGroup?.is_joined, token]);

	useEffect(() => {
		if (!selectedGroup?.id || !selectedGroup.is_joined || activeTab !== "chat" || !token || !isAuthenticated) {
			return;
		}

		const syncGroup = async () => {
			if (Date.now() - lastRealtimeSignalAtRef.current < 5000) {
				return;
			}

			try {
				const response = await apiFetch(`/group-purchases/${selectedGroup.id}`, {
					headers: getAuthHeaders(token),
					cache: "no-store",
				});

				if (!response.ok) {
					return;
				}

				const payload = await response.json();
				if (payload?.status !== 1 || !payload?.data) {
					return;
				}

				applyGroupUpdate(payload.data as GroupPurchaseDetails);
				lastRealtimeSignalAtRef.current = Date.now();
			} catch {
			}
		};

		const interval = window.setInterval(() => {
			void syncGroup();
		}, 3000);

		return () => {
			window.clearInterval(interval);
		};
	}, [activeTab, applyGroupUpdate, isAuthenticated, selectedGroup?.id, selectedGroup?.is_joined, token]);

	const highlightedCard = useMemo(() => {
		if (!selectedProductId) {
			return null;
		}

		return cards.find((card) => card.product.id === selectedProductId) || null;
	}, [cards, selectedProductId]);

	const blockingGroup = useMemo(() => {
		const groups = cards
			.map((card) => card.active_group)
			.filter((group): group is GroupPurchaseDetails => Boolean(group));

		const selectedCandidate = selectedGroup && selectedGroup.is_joined
			? [selectedGroup, ...groups]
			: groups;

		return selectedCandidate.find((group) => {
			if (!group.is_joined) {
				return false;
			}

			if (group.status === "open") {
				return true;
			}

			return group.status === "completed" && group.purchase_status === "awaiting_purchases" && !group.has_purchased;
		}) || null;
	}, [cards, selectedGroup]);

	const ensureAuthenticated = () => {
		if (isAuthenticated) {
			return true;
		}

		const redirect = `/signin?redirect=${encodeURIComponent(`/group-purchase${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`;
		router.push(redirect);
		return false;
	};

	const buildExistingGroupAction = useCallback((groupId?: string) => {
		if (!groupId) {
			return (
				<button
					type="button"
					onClick={() => router.push("/user-dashboard/group")}
					className="inline-flex rounded-full border border-[#d6d0c7] px-4 py-2 text-sm font-semibold text-primary-black transition hover:bg-white"
				>
					Open My Groups
				</button>
			);
		}

		return (
			<button
				type="button"
				onClick={() => router.push(`/group-purchase?group=${encodeURIComponent(groupId)}`)}
				className="inline-flex rounded-full border border-[#d6d0c7] px-4 py-2 text-sm font-semibold text-primary-black transition hover:bg-white"
			>
				Open Active Group
			</button>
		);
	}, [router]);

	const handleStartGroup = async (productId: string) => {
		if (!ensureAuthenticated() || !token) {
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await apiFetch("/group-purchases", {
				method: "POST",
				headers: {
					...getAuthHeaders(token),
					...(getRealtimeSocketId() ? { "X-Socket-Id": getRealtimeSocketId() as string } : {}),
				},
				body: JSON.stringify({ product_id: productId }),
			});
			const payload = await response.json();

			if (!response.ok || payload?.status !== 1) {
				const message = extractApiError(payload, "Could not start the group purchase.");
				toast({
					title: "Group purchase unavailable",
					description: message,
					action: buildExistingGroupAction(payload?.data?.group_id),
				});
				return;
			}

			const group = payload.data as GroupPurchaseDetails;
			applyGroupUpdate(group);
			router.replace(`/group-purchase?group=${encodeURIComponent(group.id)}`);
		} catch (submitError) {
			toast({
				title: "Group purchase unavailable",
				description: submitError instanceof Error ? submitError.message : "Could not start the group purchase.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleJoinGroup = async () => {
		if (!selectedGroup) {
			return;
		}

		if (!ensureAuthenticated() || !token) {
			return;
		}

		setIsSubmitting(true);

		try {
			const path = inviteToken
				? `/group-purchases/invitations/${encodeURIComponent(inviteToken)}/join`
				: `/group-purchases/${encodeURIComponent(selectedGroup.id)}/join`;
			const response = await apiFetch(path, {
				method: "POST",
				headers: {
					...getAuthHeaders(token),
					...(getRealtimeSocketId() ? { "X-Socket-Id": getRealtimeSocketId() as string } : {}),
				},
			});
			const payload = await response.json();

			if (!response.ok || payload?.status !== 1) {
				const message = extractApiError(payload, "Could not join this group purchase.");
				toast({
					title: "Join failed",
					description: message,
					action: buildExistingGroupAction(payload?.data?.group_id),
				});
				return;
			}

			const group = payload.data as GroupPurchaseDetails;
			applyGroupUpdate(group);
			router.replace(`/group-purchase?group=${encodeURIComponent(group.id)}`);
		} catch (joinError) {
			toast({
				title: "Join failed",
				description: joinError instanceof Error ? joinError.message : "Could not join this group purchase.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const copyTextToClipboard = async (value: string) => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			throw new Error("Clipboard is not available.");
		}

		if (window.isSecureContext && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(value);
			return;
		}

		const textarea = document.createElement("textarea");
		textarea.value = value;
		textarea.setAttribute("readonly", "true");
		textarea.style.position = "fixed";
		textarea.style.left = "-9999px";
		textarea.style.top = "0";

		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();

		try {
			const copied = document.execCommand("copy");
			if (!copied) {
				throw new Error("Copy command was rejected.");
			}
		} finally {
			document.body.removeChild(textarea);
		}
	};

	const handleCopyInvite = async () => {
		if (!selectedGroup || typeof window === "undefined") {
			return;
		}

		try {
			const fallbackPath = selectedGroup.share_token ? `/group-purchase?invite=${encodeURIComponent(selectedGroup.share_token)}` : `/group-purchase?group=${encodeURIComponent(selectedGroup.id)}`;
			const shareUrl = new URL(selectedGroup.share_path || fallbackPath, window.location.origin).toString();

			await copyTextToClipboard(shareUrl);
			toast({
				title: "Invite link copied",
				description: "Share the link with friends so they can join this group purchase.",
			});
		} catch (copyError) {
			toast({
				title: "Copy failed",
				description: copyError instanceof Error ? copyError.message : "Could not copy the invite link. Please try again.",
			});
		}
	};

	const handleProceedToCheckout = () => {
		if (!selectedGroup) {
			return;
		}

		if (!ensureAuthenticated()) {
			return;
		}

		router.push(`/checkout-one?groupPurchase=${encodeURIComponent(selectedGroup.id)}`);
	};

	const handleSendMessage = async () => {
		if (!selectedGroup || !selectedGroup.is_joined || !token) {
			return;
		}

		const message = draftMessage.trim();
		if (!message) {
			return;
		}

		setIsSubmitting(true);

		try {
			const response = await apiFetch(`/group-purchases/${selectedGroup.id}/messages`, {
				method: "POST",
				headers: {
					...getAuthHeaders(token),
					...(getRealtimeSocketId() ? { "X-Socket-Id": getRealtimeSocketId() as string } : {}),
				},
				body: JSON.stringify({ message }),
			});
			const payload = await response.json();

			if (!response.ok || payload?.status !== 1) {
				throw new Error(extractApiError(payload, "Could not send the message."));
			}

			setSelectedGroup((current) =>
				current
					? {
							...current,
							messages: [...(current.messages || []), payload.data as GroupPurchaseMessage],
						}
					: current,
			);
			setDraftMessage("");
		} catch (sendError) {
			toast({
				title: "Message failed",
				description: sendError instanceof Error ? sendError.message : "Could not send the message.",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (!inviteToken || !selectedGroup || selectedGroup.is_joined || !isAuthenticated || !token || !canJoinSelectedGroup) {
			return;
		}

		if (attemptedInviteJoinRef.current === selectedGroup.id) {
			return;
		}

		attemptedInviteJoinRef.current = selectedGroup.id;

		const autoJoin = async () => {
			setIsSubmitting(true);

			try {
				const response = await apiFetch(`/group-purchases/invitations/${encodeURIComponent(inviteToken)}/join`, {
					method: "POST",
					headers: {
						...getAuthHeaders(token),
						...(getRealtimeSocketId() ? { "X-Socket-Id": getRealtimeSocketId() as string } : {}),
					},
				});
				const payload = await response.json();

				if (!response.ok || payload?.status !== 1) {
					const message = extractApiError(payload, "Could not join this group purchase.");
					toast({
						title: "Join failed",
						description: message,
						action: buildExistingGroupAction(payload?.data?.group_id),
					});
					return;
				}

				const group = payload.data as GroupPurchaseDetails;
				applyGroupUpdate(group);
				router.replace(`/group-purchase?group=${encodeURIComponent(group.id)}`);
			} catch (joinError) {
				toast({
					title: "Join failed",
					description: joinError instanceof Error ? joinError.message : "Could not join this group purchase.",
				});
			} finally {
				setIsSubmitting(false);
			}
		};

		void autoJoin();
	}, [applyGroupUpdate, buildExistingGroupAction, canJoinSelectedGroup, inviteToken, selectedGroup, isAuthenticated, token, router]);

	return (
		<div className="section py-10">
			<div className="overflow-hidden rounded-[30px] border border-[#d7d3cc] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
				<div className="grid min-h-[760px] grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[460px_minmax(0,1fr)]">
					<aside className="border-b border-[#ece7df] bg-[#fbfaf7] xl:border-b-0 xl:border-r">
						<div className="border-b border-[#ece7df] px-6 py-5">
							<p className="text-sm uppercase tracking-[0.18em] text-[#7d746a]">Shop Together</p>
							<h1 className="mt-2 text-2xl font-semibold text-[#1d1b19]">Group Purchase</h1>
						</div>

						<div className="px-5 py-5 xl:px-7">
							{selectedGroup ? (
								<div className="space-y-5">
									<div className="flex items-start gap-3">
										<div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-[#f4efe8]">
											<SafeImage unoptimized src={selectedGroup.product?.thumbnail || "/images/placeholder.jpg"} alt={selectedGroup.product?.name || "Group purchase"} fill className="object-cover" />
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-start justify-between gap-3">
												<p className="line-clamp-2 font-semibold text-[#1d1b19]">{selectedGroup.product?.name || "Group purchase"}</p>
												<span
													className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
														selectedGroup.status === "completed"
															? "bg-[#eafbf0] text-primary-green"
															: "bg-[#fff1f1] text-[#c54b4b]"
													}`}
												>
													{selectedGroup.status === "completed" ? "Completed" : "Open"}
												</span>
											</div>
											<p className="mt-1 text-sm font-medium text-primary-green">
												Discount{" "}
												{selectedGroup.discount_type === "percent"
													? `${selectedGroup.discount_amount}%`
													: formatAmount(selectedGroup.discount_amount)}
											</p>
										</div>
									</div>

									<div>
										<div className="mb-2 flex items-center justify-between text-sm text-[#5f574f]">
											<span>Members</span>
											<span>
												{selectedGroup.joined_count} of {selectedGroup.minimum_users} joined
											</span>
										</div>
										<div className="h-2 rounded-full bg-[#e6e0d8]">
											<div
												className="h-full rounded-full bg-primary-green transition-all"
												style={{ width: `${Math.min((selectedGroup.joined_count / selectedGroup.minimum_users) * 100, 100)}%` }}
											/>
										</div>
									</div>

									<div className="flex items-center justify-between text-sm text-[#6e655d]">
										<div className="flex items-center gap-2">
											<Clock3 className="h-4 w-4" />
											<span>{selectedGroup.expires_at ? new Date(selectedGroup.expires_at).toLocaleString() : "Open group"}</span>
										</div>
										<span>{selectedGroup.discount_type === "percent" ? `${selectedGroup.discount_amount}% off` : formatAmount(selectedGroup.discount_amount)}</span>
									</div>

									<div className="flex gap-3">
										<Button onClick={handleCopyInvite} className="flex-1 bg-[#6d28ff] text-white hover:bg-[#591fe0]">
											<Copy className="mr-2 h-4 w-4" />
											Invite Friends
										</Button>
										{!selectedGroup.is_joined ? canJoinSelectedGroup ? (
											<Button variant="outline" onClick={handleJoinGroup} disabled={isSubmitting} className="border-[#d6d0c7]">
												Join
											</Button>
										) : (
											<Button variant="outline" disabled className="border-[#e0d7cf] text-[#9a8f83]">
												Group Full
											</Button>
										) : null}
									</div>

									{selectedGroup.is_joined && selectedGroup.purchase_status === "awaiting_purchases" ? (
										<div className="rounded-2xl border border-[#ddd6ce] bg-white px-4 py-4">
											<p className="text-sm font-semibold text-[#1d1b19]">
												{selectedGroup.has_purchased ? "Your order is already placed." : "Group checkout is ready."}
											</p>
											<p className="mt-1 text-sm text-[#6f675e]">
												{selectedGroup.has_purchased
													? `Waiting for ${selectedGroup.remaining_purchases || 0} more member${(selectedGroup.remaining_purchases || 0) > 1 ? "s" : ""} to complete checkout so the discount applies to everyone.`
													: `All ${selectedGroup.minimum_users} members joined. Place your order now so the discount can unlock for everyone.`}
											</p>
											{selectedGroup.purchase_deadline_at ? (
												<p className="mt-2 text-xs text-[#8a7f73]">
													Checkout deadline: {new Date(selectedGroup.purchase_deadline_at).toLocaleString()}
												</p>
											) : null}
											{canCheckoutSelectedGroup ? (
												<Button onClick={handleProceedToCheckout} className="mt-4 w-full bg-[#6d28ff] text-white hover:bg-[#591fe0]">
													Place Group Order
												</Button>
											) : null}
										</div>
									) : null}

									{selectedGroup.is_joined && selectedGroup.purchase_status === "discount_unlocked" ? (
										<div className="rounded-2xl border border-[#dcefdc] bg-[#eefaf0] px-4 py-4 text-sm text-[#2f6b39]">
											Discount unlocked for all members. Group orders have been updated to the discounted price.
										</div>
									) : null}

									{!selectedGroup.is_joined && !canJoinSelectedGroup ? (
										<p className="rounded-2xl border border-[#f1ddd0] bg-[#fff8f2] px-4 py-3 text-sm text-[#8a6448]">
											Maximum members reached. You can still view this group, but only joined members can chat.
										</p>
									) : null}

									{canViewPrivateGroupArea ? (
										<div className="grid grid-cols-3 rounded-[28px] border border-[#e8ddd0] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8f3_100%)] p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
											{TABS.map((tab) => {
												const Icon = tab.icon;
												const isActive = activeTab === tab.id;

												return (
													<button
														key={tab.id}
														type="button"
														onClick={() => setActiveTab(tab.id)}
														className={`rounded-[22px] px-3 py-3 text-sm transition-all duration-200 ${isActive ? "bg-[linear-gradient(135deg,#f4eeff_0%,#ece4ff_100%)] font-semibold text-[#5c2de1] shadow-[0_10px_24px_rgba(92,45,225,0.14)]" : "text-[#6f675e] hover:bg-white hover:text-[#2f2a25]"}`}
													>
														<Icon className="mx-auto mb-1.5 h-4 w-4" />
														{tab.label}
													</button>
												);
											})}
										</div>
									) : (
										<div className="rounded-2xl border border-[#ebe3da] bg-white px-4 py-4 text-sm text-[#6f675e]">
											{isAuthenticated
												? "Join this group purchase to view members, chat, and checkout details."
												: "Sign in and join this group purchase to view members and live discussion."}
										</div>
									)}

									{canViewPrivateGroupArea && activeTab === "members" ? (
										<div className="space-y-3">
											<div className="flex items-center justify-between">
												<p className="text-sm font-semibold text-[#5f574f]">Joined Members</p>
												<span className="rounded-full bg-[#eef8f0] px-3 py-1 text-xs font-semibold text-primary-green">
													{selectedGroup.members?.length || 0} online in deal
												</span>
											</div>
											{selectedGroup.members?.map((member) => (
												<div key={member.id} className="rounded-[24px] border border-[#dcefdc] bg-[linear-gradient(180deg,#f7fff8_0%,#edf9ef_100%)] p-3.5 shadow-[0_12px_30px_rgba(47,107,57,0.06)]">
													<div className="flex items-center gap-3">
														<div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/80 bg-white shadow-sm">
															{member.user?.profile_image ? (
																<SafeImage unoptimized src={member.user.profile_image} alt={member.user.name} fill className="object-cover" />
															) : (
																<div className="flex h-full items-center justify-center text-sm font-semibold text-primary-green">{member.user?.name?.charAt(0) || "U"}</div>
															)}
														</div>
														<div className="min-w-0 flex-1">
															<p className="font-semibold text-[#1d1b19]">{member.user?.name || "Customer"}</p>
															<p className="text-sm text-[#6f675e]">{member.joined_at ? new Date(member.joined_at).toLocaleString() : "Joined"}</p>
														</div>
														<div className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#2f6b39]">
															Member
														</div>
													</div>
												</div>
											))}
										</div>
									) : null}

									{canViewPrivateGroupArea && activeTab === "chat" ? (
										<div className="space-y-4">
											<div className="rounded-[28px] border border-[#eadfd3] bg-[linear-gradient(180deg,#ffffff_0%,#faf6f1_100%)] p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
												<div className="mb-4 flex items-start justify-between gap-3">
													<div className="min-w-0">
														<p className="text-base font-semibold text-[#1d1b19]">Group Conversation</p>
														<p className="mt-1 text-sm leading-5 text-[#8b7f73]">Coordinate orders, confirm members, and keep everyone updated.</p>
													</div>
													<div className="rounded-full bg-[#f3ecff] px-3 py-1 text-xs font-semibold text-[#5c2de1]">
														{selectedGroup.messages?.length || 0} chats
													</div>
												</div>
												<div className="max-h-[420px] space-y-4 overflow-y-auto rounded-[24px] border border-[#efe5da] bg-[#fffdfa] p-4">
												{selectedGroup.messages?.length ? selectedGroup.messages.map((message) => (
													<div key={message.id} className={`flex ${message.is_mine ? "justify-end" : "justify-start"}`}>
														<div className={`max-w-full rounded-[24px] border px-4 py-3 shadow-sm ${message.is_mine ? "border-[#6d28ff] bg-gradient-to-br from-[#7c3aed] to-[#5b21e6]" : "border-[#eadfd2] bg-white text-[#2f2a25]"}`}>
															<div className={`flex items-center justify-between gap-3 text-xs ${message.is_mine ? "!text-white/80" : "text-[#8b7f73]"}`}>
																<span className={`truncate font-semibold ${message.is_mine ? "!text-white" : "text-[#2f2a25]"}`}>{message.user?.name || "Member"}</span>
																<span className="shrink-0">
																	{message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Now"}
																</span>
															</div>
															<p className={`mt-2 whitespace-pre-wrap break-words text-base leading-7 ${message.is_mine ? "!text-white" : "text-[#332d27]"}`}>
																{message.message}
															</p>
														</div>
													</div>
												)) : (
													<div className="rounded-[24px] border border-dashed border-[#dfd4c7] bg-white/80 px-4 py-5 text-center text-sm text-[#7c7166]">
														No messages yet. Start the conversation and invite everyone to coordinate the purchase.
													</div>
												)}
												</div>
											</div>
											{selectedGroup.is_joined ? (
												<div className="space-y-3 rounded-[28px] border border-[#e7dbcf] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8f4_100%)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
													<div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-[#8b7f73]">
														<span>Group Chat</span>
														<span>{selectedGroup.messages?.length || 0} messages</span>
													</div>
													<textarea
														value={draftMessage}
														onChange={(event) => setDraftMessage(event.target.value)}
														rows={5}
														placeholder="Write a quick message to the group"
														className="w-full resize-none rounded-[22px] border border-[#ddd6ce] bg-[#fcfaf7] px-4 py-3 text-base leading-7 text-[#2f2a25] outline-none transition placeholder:text-[#a19385] focus:border-[#6d28ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(109,40,255,0.08)]"
													/>
													<Button onClick={handleSendMessage} disabled={isSubmitting} className="h-12 w-full rounded-[18px] bg-[linear-gradient(135deg,#7c3aed_0%,#5b21e6_100%)] text-base font-semibold text-white shadow-[0_16px_35px_rgba(109,40,255,0.28)] hover:opacity-95">
														{isSubmitting ? "Sending..." : "Send Message"}
													</Button>
												</div>
											) : null}
										</div>
									) : null}

									{canViewPrivateGroupArea && activeTab === "summary" ? (
										<div className="rounded-[28px] border border-[#eadfd3] bg-[linear-gradient(180deg,#ffffff_0%,#faf6f1_100%)] p-5 shadow-[0_20px_48px_rgba(15,23,42,0.06)]">
											<div className="flex items-start justify-between gap-3">
												<div>
													<p className="text-sm uppercase tracking-[0.16em] text-[#8b7f73]">Group Price</p>
													<p className="mt-2 text-3xl font-semibold text-[#1d1b19]">{formatAmount(selectedGroup.discounted_price)}</p>
												</div>
												<div className="rounded-full bg-[#eef8f0] px-3 py-1 text-xs font-semibold text-primary-green">
													Save {formatAmount(selectedGroup.base_price - selectedGroup.discounted_price)}
												</div>
											</div>
											<p className="mt-4 text-sm leading-6 text-[#6f675e]">
												{selectedGroup.purchase_status === "awaiting_purchases"
													? `${selectedGroup.remaining_purchases || 0} more order${(selectedGroup.remaining_purchases || 0) === 1 ? "" : "s"} needed to unlock the discount for everyone.`
													: selectedGroup.purchase_status === "discount_unlocked"
														? "Everyone in this group completed checkout and the discount is now applied."
														: selectedGroup.remaining_members > 0
													? `Invite ${selectedGroup.remaining_members} more member${selectedGroup.remaining_members > 1 ? "s" : ""} to unlock the best price.`
													: "Target reached. This group is ready for checkout."}
											</p>
											<Link href={selectedGroup.product?.slug ? `/product/${selectedGroup.product.slug}` : "/group-purchase"} className="mt-5 inline-flex rounded-full bg-[#f3ecff] px-4 py-2 text-sm font-semibold text-[#5c2de1] transition hover:bg-[#eadfff]">
												View Product
											</Link>
										</div>
									) : null}
								</div>
							) : (
								<div className="rounded-3xl border border-dashed border-[#ddd4ca] bg-white p-6 text-center">
									<Sparkles className="mx-auto h-8 w-8 text-[#5c2de1]" />
									<p className="mt-4 font-semibold text-[#1d1b19]">Pick a deal to begin</p>
									<p className="mt-2 text-sm text-[#6f675e]">Start a new group purchase or open an active one from the list.</p>
								</div>
							)}
						</div>
					</aside>

					<section className="bg-white">
						<div className="flex items-center justify-between border-b border-[#ece7df] px-6 py-5">
							<div>
								<p className="text-sm uppercase tracking-[0.18em] text-[#7d746a]">Start Group Purchase</p>
								<h2 className="mt-2 text-2xl font-semibold text-[#1d1b19]">Invite friends and unlock better pricing</h2>
							</div>
							<div className="rounded-full bg-[#f5ebff] px-4 py-2 text-sm font-semibold text-[#6d28ff]">{cards.length} Items</div>
						</div>

						<div className="p-6">
							{isLoading ? (
								<div className="grid gap-6 md:grid-cols-2">
									{Array.from({ length: 4 }).map((_, index) => (
										<div key={index} className="h-[360px] animate-pulse rounded-[28px] bg-[#f3efe9]" />
									))}
								</div>
							) : error ? (
								<div className="rounded-3xl border border-[#f0d4d4] bg-[#fff5f5] p-6 text-[#a43b3b]">{error}</div>
							) : (
								<div className="grid gap-6 md:grid-cols-2">
									{cards.map((card) => {
										const group = card.active_group;
										const isGroupFull = Boolean(group && group.joined_count >= group.minimum_users);
										const isSelected = selectedGroup?.id === group?.id || highlightedCard?.product.id === card.product.id;

										return (
											<article key={card.product.id} className={`overflow-hidden rounded-[28px] border bg-white transition ${isSelected ? "border-[#8b5cf6] shadow-[0_20px_50px_rgba(109,40,255,0.12)]" : "border-[#ece7df]"}`}>
												<div className="relative h-64 overflow-hidden bg-[#f6efe6]">
													<SafeImage unoptimized src={card.product.thumbnail} alt={card.product.name} fill className="object-cover" />
													<div className="absolute left-4 top-4 rounded-full bg-primary-green px-3 py-1 text-xs font-semibold text-white">Group Deal</div>
												</div>
												<div className="space-y-4 p-5">
													<div>
														<h3 className="line-clamp-2 text-xl font-semibold text-[#1d1b19]">{card.product.name}</h3>
														<div className="mt-3 flex items-end gap-2">
															<p className="text-2xl font-semibold text-[#1d1b19]">{formatAmount(card.group_purchase.discounted_price)}</p>
															<p className="text-sm text-[#7d746a] line-through">{formatAmount(card.product.original_price)}</p>
														</div>
													</div>

													<div className="text-sm text-[#6f675e]">
														{group ? (
															<>
																<div className="mb-2 flex items-center justify-between">
																	<span>Members</span>
																	<span>
																		{group.joined_count} of {group.minimum_users} joined
																	</span>
																</div>
																<div className="h-2 rounded-full bg-[#e6e0d8]">
																	<div
																		className="h-full rounded-full bg-primary-green"
																		style={{ width: `${Math.min((group.joined_count / group.minimum_users) * 100, 100)}%` }}
																	/>
																</div>
															</>
														) : (
															<div className="rounded-2xl bg-[#f8f5ef] px-4 py-3">
																Invite {Math.max(card.group_purchase.minimum_users - 1, 1)} more friend{card.group_purchase.minimum_users - 1 === 1 ? "" : "s"} to unlock the group discount.
															</div>
														)}
													</div>

													<div className="flex items-center justify-between text-sm text-[#6f675e]">
														<div className="flex items-center gap-2">
															<Users className="h-4 w-4" />
															<span>{card.group_purchase.minimum_users} members total</span>
														</div>
														<div className="font-semibold text-primary-green">
															Save {formatAmount(card.group_purchase.discount_value)}
														</div>
													</div>

													<div className="flex gap-3">
														{group ? (
															<Button onClick={() => router.replace(`/group-purchase?group=${encodeURIComponent(group.id)}`)} className="flex-1 bg-[#6d28ff] text-white hover:bg-[#591fe0]">
																{isGroupFull || group.status === "completed" ? "View Group" : "Open Group"}
															</Button>
														) : blockingGroup && blockingGroup.product?.id !== card.product.id ? (
															<Button
																onClick={() => router.replace(`/group-purchase?group=${encodeURIComponent(blockingGroup.id)}`)}
																className="flex-1 bg-[#f3ecff] text-[#5c2de1] hover:bg-[#eadfff]"
															>
																{blockingGroup.status === "completed" && blockingGroup.purchase_status === "awaiting_purchases"
																	? "Finish Active Group"
																	: "Open Active Group"}
															</Button>
														) : (
															<Button onClick={() => void handleStartGroup(card.product.id)} disabled={isSubmitting} className="flex-1 bg-[#6d28ff] text-white hover:bg-[#591fe0]">
																Start Group Purchase
															</Button>
														)}
														<Link href={`/product/${card.product.slug}`} className="inline-flex items-center justify-center rounded-full border border-[#ddd6ce] px-5 py-3 text-sm font-semibold text-[#1d1b19] transition hover:bg-[#f8f5ef]">
															View Product
														</Link>
													</div>

													{!group && blockingGroup && blockingGroup.product?.id !== card.product.id ? (
														<p className="text-sm text-[#8a7f73]">
															{blockingGroup.status === "completed" && blockingGroup.purchase_status === "awaiting_purchases"
																? "Complete your current group order first, then you can start another group purchase."
																: "You already have an active group collecting members. Finish that one first to start a new group."}
														</p>
													) : null}
												</div>
											</article>
										);
									})}
								</div>
							)}
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
