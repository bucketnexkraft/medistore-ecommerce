"use client";

"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { Edit2, MapPin, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ShippingAddressFormState, ShippingAddressRecord } from "./settings.types";

const emptyForm: ShippingAddressFormState = {
	fullName: "",
	email: "",
	phone: "",
	address: "",
	city: "",
	country: "",
	postalCode: "",
	isDefault: true,
};

export function Addresses() {
	const { token } = useAuth();
	const [addresses, setAddresses] = useState<ShippingAddressRecord[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<ShippingAddressFormState>(emptyForm);

	const loadAddresses = useCallback(async () => {
		if (!token) {
			return;
		}

		try {
			setIsLoading(true);
			const response = await apiFetch("/customer/shipping-addresses", {
				headers: getAuthHeaders(token),
				cache: "no-store",
			});
			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1) {
				throw new Error(extractApiError(result, "Unable to load your saved addresses."));
			}

			setAddresses(Array.isArray(result?.data) ? result.data : []);
		} catch (error) {
			toast({
				title: "Could not load addresses",
				description: error instanceof Error ? error.message : "Please try again in a moment.",
				variant: "error",
			});
		} finally {
			setIsLoading(false);
		}
	}, [token]);

	useEffect(() => {
		if (!token) {
			setIsLoading(false);
			return;
		}

		void loadAddresses();
	}, [loadAddresses, token]);

	const resetForm = () => {
		setEditingId(null);
		setForm({
			...emptyForm,
			isDefault: addresses.length === 0,
		});
	};

	const handleChange = (field: keyof ShippingAddressFormState, value: string | boolean) => {
		setForm((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleEdit = (address: ShippingAddressRecord) => {
		setEditingId(address.id);
		setForm({
			fullName: address.full_name,
			email: address.email || "",
			phone: address.phone,
			address: address.address,
			city: address.city,
			country: address.country,
			postalCode: address.postal_code || "",
			isDefault: address.is_default,
		});
	};

	const handleDelete = async (addressId: string) => {
		if (!token) {
			return;
		}

		setIsSaving(true);

		try {
			const response = await apiFetch(`/customer/shipping-addresses/${encodeURIComponent(addressId)}`, {
				method: "DELETE",
				headers: getAuthHeaders(token),
			});
			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1) {
				throw new Error(extractApiError(result, "Unable to delete that address."));
			}

			if (editingId === addressId) {
				resetForm();
			}

			toast({
				title: "Address deleted",
				description: "The shipping address was removed successfully.",
			});
			await loadAddresses();
		} catch (error) {
			toast({
				title: "Delete failed",
				description: error instanceof Error ? error.message : "Unable to delete that address right now.",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!token) {
			return;
		}

		setIsSaving(true);

		try {
			const response = await apiFetch(
				editingId ? `/customer/shipping-addresses/${encodeURIComponent(editingId)}` : "/customer/shipping-addresses",
				{
					method: editingId ? "PUT" : "POST",
					headers: getAuthHeaders(token),
					body: JSON.stringify({
						full_name: form.fullName,
						email: form.email || null,
						phone: form.phone,
						address: form.address,
						city: form.city,
						country: form.country,
						postal_code: form.postalCode || null,
						is_default: form.isDefault,
					}),
				},
			);
			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1) {
				throw new Error(extractApiError(result, "Unable to save your address."));
			}

			toast({
				title: editingId ? "Address updated" : "Address saved",
				description: editingId ? "Your shipping address was updated successfully." : "Your shipping address was added successfully.",
			});
			resetForm();
			await loadAddresses();
		} catch (error) {
			toast({
				title: "Save failed",
				description: error instanceof Error ? error.message : "Unable to save your address right now.",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="rounded-lg border border-gray-200 bg-white p-6 shadow lg:p-8">
				<div className="mb-6 flex items-center justify-between gap-4">
					<div>
						<h2 className="text-2xl font-bold text-gray-900">Shipping Address</h2>
						<p className="mt-1 text-sm text-gray-600">Add, edit, and choose the address you want to reuse during checkout.</p>
					</div>
					<button
						type="button"
						onClick={resetForm}
						className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary-blue px-4 py-2 font-semibold text-white transition-colors hover:bg-primary-blue/90"
					>
						<Plus size={18} />
						<span>New Address</span>
					</button>
				</div>

				{isLoading ? (
					<p className="text-sm text-gray-600">Loading saved addresses...</p>
				) : addresses.length > 0 ? (
					<div className="grid gap-4 md:grid-cols-2">
						{addresses.map((address) => (
							<div key={address.id} className="rounded-xl border border-gray-200 bg-zinc-50 p-5">
								<div className="mb-3 flex items-start justify-between gap-3">
									<div>
										<div className="flex items-center gap-2">
											<h3 className="font-semibold text-gray-900">{address.full_name}</h3>
											{address.is_default ? (
												<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Default</span>
											) : null}
										</div>
										<p className="mt-1 text-sm text-gray-500">{address.email || "No email added"}</p>
									</div>
									<MapPin className="text-primary-blue" size={18} />
								</div>
								<div className="space-y-1 text-sm text-gray-700">
									<p>{address.phone}</p>
									<p>{address.address}</p>
									<p>
										{address.city}, {address.country}
										{address.postal_code ? ` ${address.postal_code}` : ""}
									</p>
								</div>
								<div className="mt-4 flex gap-3">
									<button
										type="button"
										onClick={() => handleEdit(address)}
										className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-white"
									>
										<Edit2 size={16} />
										<span>Edit</span>
									</button>
									<button
										type="button"
										onClick={() => void handleDelete(address.id)}
										disabled={isSaving}
										className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
									>
										<Trash2 size={16} />
										<span>Delete</span>
									</button>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="rounded-xl border border-dashed border-gray-300 bg-zinc-50 p-6 text-sm text-gray-600">
						No shipping address saved yet. Add one below and it will appear here for future checkout.
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow lg:p-8">
				<div className="mb-6 flex items-center justify-between gap-3">
					<div>
						<h3 className="text-xl font-bold text-gray-900">{editingId ? "Edit Address" : "Add Address"}</h3>
						<p className="mt-1 text-sm text-gray-600">Keep this updated so checkout can fill itself quickly.</p>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div className="sm:col-span-2">
						<label className="mb-2 block text-sm font-medium text-gray-900">Full Name</label>
						<input
							type="text"
							value={form.fullName}
							onChange={(event) => handleChange("fullName", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							placeholder="John Doe"
							required
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Email</label>
						<input
							type="email"
							value={form.email}
							onChange={(event) => handleChange("email", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							placeholder="john@example.com"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Phone</label>
						<input
							type="text"
							value={form.phone}
							onChange={(event) => handleChange("phone", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							placeholder="+880123456789"
							required
						/>
					</div>
					<div className="sm:col-span-2">
						<label className="mb-2 block text-sm font-medium text-gray-900">Address</label>
						<textarea
							value={form.address}
							onChange={(event) => handleChange("address", event.target.value)}
							className="min-h-28 w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							placeholder="House 12, Road 4, Block B"
							required
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">City</label>
						<input
							type="text"
							value={form.city}
							onChange={(event) => handleChange("city", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							required
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Country</label>
						<input
							type="text"
							value={form.country}
							onChange={(event) => handleChange("country", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
							required
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Postal Code</label>
						<input
							type="text"
							value={form.postalCode}
							onChange={(event) => handleChange("postalCode", event.target.value)}
							className="w-full rounded-lg border border-gray-200 bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600"
						/>
					</div>
					<div className="flex items-end">
						<label className="inline-flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800">
							<input
								type="checkbox"
								checked={form.isDefault}
								onChange={(event) => handleChange("isDefault", event.target.checked)}
								className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
							/>
							<span>Set as default address</span>
						</label>
					</div>
				</div>

				<div className="mt-6 flex flex-col justify-end gap-3 border-t border-gray-200 pt-6 sm:flex-row">
					<button
						type="button"
						onClick={resetForm}
						className="cursor-pointer rounded-lg border border-gray-300 px-5 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
					>
						Clear
					</button>
					<button
						type="submit"
						disabled={isSaving}
						className="cursor-pointer rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSaving ? "Saving..." : editingId ? "Update Address" : "Save Address"}
					</button>
				</div>
			</form>
		</div>
	);
}
