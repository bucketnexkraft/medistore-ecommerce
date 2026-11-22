interface UserDashTitleProps {
	title: string;
	subtitle: string;
}

export function UserDashTitle({ title, subtitle }: UserDashTitleProps) {
	return (
		<div className="mb-8">
			<h1 className="text-3xl sm:text-4xl font-bold mb-2">{title}</h1>
			<span className="text-2xl text-primary-body">{subtitle}</span>
		</div>
	);
}
