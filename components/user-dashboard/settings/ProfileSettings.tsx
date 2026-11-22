"use client";

import { UserDashTitle } from "../common/UserDashTitle";
import { Addresses } from "./Addresses";
import { PersonalInfo } from "./PersonalInfo";
import { Privacy } from "./Privacy";
import { SettingsNav } from "./SettingsNav";

interface ProfileSettingsProps {
	tab?: string;
}

export function ProfileSettings({ tab = "personal" }: ProfileSettingsProps) {
	const renderContent = () => {
		switch (tab) {
			case "personal":
				return <PersonalInfo />;
			case "addresses":
				return <Addresses />;
			case "privacy":
				return <Privacy />;
			default:
				return <PersonalInfo />;
		}
	};

	return (
		<main className="flex-1 overflow-y-auto">
			<UserDashTitle title="Profile & Settings" subtitle="Manage your account and preferences" />

			<div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
				{/* Left - Navigation */}
				<div className="lg:col-span-1">
					<SettingsNav />
				</div>

				{/* Right - Content */}
				<div className="lg:col-span-3">{renderContent()}</div>
			</div>
		</main>
	);
}
