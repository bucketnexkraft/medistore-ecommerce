import { ProfileSettings } from "@/components/user-dashboard/settings/ProfileSettings";

// import { Sidebar } from '@/components/Sidebar';
// import { ProfileSettings } from '@/components/ProfileSettings';

interface SettingsPageProps {
	params: Promise<{
		tab: string;
	}>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
	const { tab } = await params;

	return (
		<div>
			<ProfileSettings tab={tab} />
		</div>
	);
}
