"use client";

import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, Facebook, MessageCircleMore } from "lucide-react";
import { useState } from "react";

type SupportChannel = "facebook" | "whatsapp";

const channelOptions: Array<{
	id: SupportChannel;
	label: string;
	description: string;
	icon: typeof Facebook;
}> = [
	{
		id: "facebook",
		label: "Facebook",
		description: "Let buyers start support conversations from your Facebook page.",
		icon: Facebook,
	},
	{
		id: "whatsapp",
		label: "Whatsapp",
		description: "Share your WhatsApp support line for fast order updates.",
		icon: MessageCircleMore,
	},
];

export function ChatSupportSettings() {
	const [selectedChannel, setSelectedChannel] = useState<SupportChannel>("facebook");

	return (
		<section className="space-y-8">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<button
					type="button"
					aria-label="Go back"
					className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:border-violet-300 hover:text-violet-700"
				>
					<ChevronLeft className="h-8 w-8" />
				</button>
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Chat Support</h1>
				</div>
			</div>

			<div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:p-8">
				<div className="rounded-[22px] border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#faf7ff_100%)] p-6 sm:p-8">
					<h2 className="text-2xl font-semibold text-slate-900">Chat Support</h2>

					<div className="mt-8 flex flex-wrap gap-4">
						{channelOptions.map((channel) => {
							const active = selectedChannel === channel.id;
							const Icon = channel.icon;

							return (
								<button
									key={channel.id}
									type="button"
									onClick={() => setSelectedChannel(channel.id)}
									className={`flex items-center gap-3 rounded-full border px-5 py-3 text-lg font-medium transition ${
										active
											? "border-violet-600 bg-violet-50 text-violet-700 shadow-[0_8px_20px_rgba(109,40,217,0.12)]"
											: "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700"
									}`}
								>
									<span
										className={`flex h-11 w-11 items-center justify-center rounded-full border ${
											active ? "border-violet-600 bg-white text-violet-700" : "border-slate-200 bg-slate-50 text-slate-500"
										}`}
									>
										{active ? <Check className="h-6 w-6" /> : <Icon className="h-5 w-5" />}
									</span>
									{channel.label}
								</button>
							);
						})}
					</div>

					<p className="mt-8 text-2xl font-medium text-[#d68600]">Select one of the chat options to setup chat support</p>

					<div className="mt-8 grid gap-4 rounded-[22px] border border-dashed border-violet-200 bg-white/80 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
						<div>
							<p className="text-lg font-semibold text-slate-900">
								{selectedChannel === "facebook" ? "Facebook Messenger" : "WhatsApp Business"} selected
							</p>
							<p className="mt-1 text-sm text-slate-500">
								{channelOptions.find((channel) => channel.id === selectedChannel)?.description}
							</p>
						</div>
						<Button className="h-auto rounded-2xl bg-linear-to-r from-[#7c2cff] to-[#5b08d6] px-6 py-4 text-lg font-semibold text-white hover:from-[#6d20ef] hover:to-[#4c05b9]">
							Update Chat Support Info
						</Button>
					</div>
				</div>
			</div>
		</section>
	);
}
