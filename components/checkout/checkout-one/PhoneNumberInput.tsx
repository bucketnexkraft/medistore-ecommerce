"use client";

import PhoneInput from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";
import { cn } from "@/lib/utils";

interface PhoneNumberInputProps {
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	error?: string;
	className?: string;
}

export function PhoneNumberInput({ value, onChange, onBlur, error, className }: PhoneNumberInputProps) {
	const isInvalid = Boolean(value.trim()) && !isValidPhoneNumber(value);

	return (
		<div
			className={cn(
				"phone-number-input flex w-full overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-purple-600 focus-within:border-transparent",
				error || isInvalid ? "border-rose-400 bg-rose-50/60" : "border-gray-200",
				className,
			)}
		>
			<PhoneInput
				defaultCountry="BD"
				international={false}
				countryCallingCodeEditable={false}
				value={value || undefined}
				onChange={(nextValue) => onChange(nextValue || "")}
				onBlur={onBlur}
				placeholder="Enter phone number"
				className="w-full"
			/>
		</div>
	);
}
