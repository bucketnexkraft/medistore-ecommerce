"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { extractApiError, getAuthHeaders } from "@/lib/auth";
import { apiFetch } from "@/lib/api-client";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useState } from "react";

type PasswordFormState = {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
};

const initialForm: PasswordFormState = {
	currentPassword: "",
	newPassword: "",
	confirmPassword: "",
};

export function Privacy() {
	const { token } = useAuth();
	const [form, setForm] = useState<PasswordFormState>(initialForm);
	const [isSaving, setIsSaving] = useState(false);
	const [showPassword, setShowPassword] = useState({
		current: false,
		next: false,
		confirm: false,
	});

	const updateField = (field: keyof PasswordFormState, value: string) => {
		setForm((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!token) {
			toast({
				title: "Please sign in again",
				description: "Your session expired before we could change the password.",
				variant: "error",
			});
			return;
		}

		if (form.newPassword.length < 6) {
			toast({
				title: "Password too short",
				description: "Your new password must be at least 6 characters long.",
				variant: "error",
			});
			return;
		}

		if (form.newPassword !== form.confirmPassword) {
			toast({
				title: "Passwords do not match",
				description: "Please make sure your new password and confirmation match.",
				variant: "error",
			});
			return;
		}

		setIsSaving(true);

		try {
			const response = await apiFetch("/change/password", {
				method: "POST",
				headers: getAuthHeaders(token),
				body: JSON.stringify({
					current_password: form.currentPassword,
					new_password: form.newPassword,
					new_password_confirmation: form.confirmPassword,
				}),
			});
			const result = await response.json().catch(() => null);

			if (!response.ok || result?.status !== 1) {
				throw new Error(extractApiError(result, "Unable to change your password."));
			}

			setForm(initialForm);
			toast({
				title: "Password changed",
				description: "Your password was updated successfully.",
			});
		} catch (error) {
			toast({
				title: "Change failed",
				description: error instanceof Error ? error.message : "Unable to change your password right now.",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="rounded-lg border border-gray-200 bg-white p-6 shadow lg:p-8">
			<div className="mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Change Password</h2>
				<p className="mt-1 text-sm text-gray-600">Update your password here. You&apos;ll keep your current session after saving.</p>
			</div>

			<form onSubmit={handleSubmit} className="space-y-5">
				<PasswordField
					label="Current Password"
					value={form.currentPassword}
					onChange={(value) => updateField("currentPassword", value)}
					show={showPassword.current}
					onToggle={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
				/>
				<PasswordField
					label="New Password"
					value={form.newPassword}
					onChange={(value) => updateField("newPassword", value)}
					show={showPassword.next}
					onToggle={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
				/>
				<PasswordField
					label="Confirm New Password"
					value={form.confirmPassword}
					onChange={(value) => updateField("confirmPassword", value)}
					show={showPassword.confirm}
					onToggle={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
				/>

				<div className="rounded-xl border border-gray-200 bg-zinc-50 p-4 text-sm text-gray-600">
					Use at least 6 characters. A longer password with numbers and symbols is safer.
				</div>

				<div className="flex justify-end border-t border-gray-200 pt-6">
					<button
						type="submit"
						disabled={isSaving}
						className="cursor-pointer rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSaving ? "Updating..." : "Update Password"}
					</button>
				</div>
			</form>
		</div>
	);
}

type PasswordFieldProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
	show: boolean;
	onToggle: () => void;
};

function PasswordField({ label, value, onChange, show, onToggle }: PasswordFieldProps) {
	return (
		<div>
			<label className="mb-2 block text-sm font-medium text-gray-900">{label}</label>
			<div className="relative">
				<span className="absolute left-4 top-4 text-primary-body">
					<LockKeyhole size={18} />
				</span>
				<input
					type={show ? "text" : "password"}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="w-full rounded-lg border border-gray-200 bg-zinc-100 py-3 pl-10 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-600"
					required
				/>
				<button
					type="button"
					onClick={onToggle}
					className="absolute right-4 top-3.5 cursor-pointer text-gray-500 transition-colors hover:text-gray-700"
				>
					{show ? <EyeOff size={18} /> : <Eye size={18} />}
				</button>
			</div>
		</div>
	);
}
