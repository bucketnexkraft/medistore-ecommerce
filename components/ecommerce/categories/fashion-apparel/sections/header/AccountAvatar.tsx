"use client";

import Image from "next/image";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { getUserDisplayName, getUserInitials } from "@/lib/auth";
import { resolveApiAssetUrl } from "@/lib/config";

type AccountAvatarProps = {
	className?: string;
};

export function AccountAvatar({ className = "size-7" }: AccountAvatarProps) {
	const { user, isLoading } = useAuth();
	const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
	const imageSrc = user?.profile_image ? resolveApiAssetUrl(user.profile_image) : null;
	const imageFailed = imageSrc !== null && failedImageSrc === imageSrc;

	return (
		<span
			className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f49b44] text-[#242424] ${className}`}
			title={getUserDisplayName(user)}
		>
			{imageSrc && !imageFailed ? (
				<Image
					loader={({ src }) => src}
					unoptimized
					src={imageSrc}
					alt={getUserDisplayName(user)}
					fill
					className="object-cover"
					onError={() => setFailedImageSrc(imageSrc)}
				/>
			) : (
				<span className="text-xs font-semibold" aria-hidden="true">
					{isLoading && !user ? "" : getUserInitials(user)}
				</span>
			)}
		</span>
	);
}
