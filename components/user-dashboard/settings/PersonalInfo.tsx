"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { extractApiError } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { Edit2, Mail, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PersonalInfoFormState = {
	firstName: string;
	lastName: string;
	email: string;
	phone: string;
};

const buildFormState = (user: ReturnType<typeof useAuth>["user"]): PersonalInfoFormState => ({
	firstName: user?.first_name || "",
	lastName: user?.last_name || "",
	email: user?.email || "",
	phone: user?.phone || "",
});

export function PersonalInfo() {
	const { user, token, roleName, setAuthSession } = useAuth();
	const [formData, setFormData] = useState<PersonalInfoFormState>(() => buildFormState(user));
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedImage, setSelectedImage] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		setFormData(buildFormState(user));
		setSelectedImage(null);
		setImagePreview(null);
	}, [user]);

	useEffect(() => {
		if (!selectedImage) {
			return;
		}

		const objectUrl = URL.createObjectURL(selectedImage);
		setImagePreview(objectUrl);

		return () => URL.revokeObjectURL(objectUrl);
	}, [selectedImage]);

	const initials = useMemo(() => {
		return `${formData.firstName.charAt(0)}${formData.lastName.charAt(0)}`.trim().toUpperCase() || "GU";
	}, [formData.firstName, formData.lastName]);

	const avatarUrl = imagePreview || user?.profile_image || null;

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleCancel = () => {
		setFormData(buildFormState(user));
		setSelectedImage(null);
		setImagePreview(null);
		setIsEditing(false);
	};

	const handleSave = async () => {
		if (!token) {
			toast({
				title: "Please sign in again",
				description: "Your session is missing. Refresh and sign in again.",
				variant: "error",
			});
			return;
		}

		setIsSaving(true);

		try {
			const payload = new FormData();
			payload.append("first_name", formData.firstName);
			payload.append("last_name", formData.lastName);
			payload.append("email", formData.email);
			payload.append("phone", formData.phone);

			if (selectedImage) {
				payload.append("image", selectedImage);
			}

			const response = await apiFetch("/update/profile", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/json",
				},
				body: payload,
			});

			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1 || !result?.user) {
				throw new Error(extractApiError(result, "Unable to update your profile."));
			}

			setAuthSession({
				token,
				user: result.user,
				role_name: roleName,
			});
			setSelectedImage(null);
			setImagePreview(null);
			setIsEditing(false);

			toast({
				title: "Profile updated",
				description: "Your personal information was saved successfully.",
			});
		} catch (error) {
			toast({
				title: "Update failed",
				description: error instanceof Error ? error.message : "Unable to update your profile right now.",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="rounded-lg border bg-white p-6 shadow lg:p-8">
			<div className="mb-8 flex items-center justify-between">
				<h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
				<button
					type="button"
					onClick={() => (isEditing ? handleCancel() : setIsEditing(true))}
					className="flex cursor-pointer items-center gap-2 rounded-sm bg-purple-100 px-2.5 py-1.5 font-semibold text-primary-blue hover:text-purple-700"
				>
					<Edit2 size={18} />
					<span>{isEditing ? "Cancel" : "Edit"}</span>
				</button>
			</div>

			<div className="mb-8 flex flex-col items-center gap-6 border-b border-gray-200 pb-8 sm:flex-row">
				<div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-primary-blue via-primary-blue/90 to-purple-500 text-3xl font-bold text-white">
					{avatarUrl ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
					) : (
						initials
					)}
				</div>
				<div>
					<h3 className="mb-2 text-lg font-semibold text-gray-900">Change Photo</h3>
					<p className="text-sm text-gray-600">JPG, PNG, GIF or WEBP, max 2MB</p>
					{isEditing ? (
						<input
							type="file"
							accept="image/png,image/jpeg,image/gif,image/webp"
							onChange={(event) => setSelectedImage(event.target.files?.[0] || null)}
							className="mt-3 text-sm text-gray-700"
						/>
					) : null}
				</div>
			</div>

			<div className="space-y-6">
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">First Name</label>
						<input
							type="text"
							name="firstName"
							value={formData.firstName}
							onChange={handleInputChange}
							disabled={!isEditing}
							className="w-full rounded-lg border border-secondary-stroke bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100"
						/>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Last Name</label>
						<input
							type="text"
							name="lastName"
							value={formData.lastName}
							onChange={handleInputChange}
							disabled={!isEditing}
							className="w-full rounded-lg border border-secondary-stroke bg-zinc-100 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100"
						/>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Email</label>
						<div className="relative">
							<span className="absolute left-4 top-4 text-primary-body">
								<Mail size={18} />
							</span>
							<input
								type="email"
								name="email"
								value={formData.email}
								onChange={handleInputChange}
								disabled={!isEditing}
								className="w-full rounded-lg border border-secondary-stroke bg-zinc-100 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100"
							/>
						</div>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-gray-900">Phone</label>
						<div className="relative">
							<span className="absolute left-4 top-4 text-primary-body">
								<Phone size={18} />
							</span>
							<input
								type="tel"
								name="phone"
								value={formData.phone}
								onChange={handleInputChange}
								disabled={!isEditing}
								className="w-full rounded-lg border border-secondary-stroke bg-zinc-100 py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:cursor-not-allowed disabled:bg-gray-100"
							/>
						</div>
					</div>
				</div>

			</div>

			{isEditing ? (
				<div className="mt-8 flex flex-col justify-end gap-3 border-t border-gray-200 pt-8 sm:flex-row">
					<button
						type="button"
						onClick={handleCancel}
						className="cursor-pointer rounded-lg border border-gray-300 px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={isSaving}
						className="cursor-pointer rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSaving ? "Saving..." : "Save Changes"}
					</button>
				</div>
			) : null}
		</div>
	);
}
