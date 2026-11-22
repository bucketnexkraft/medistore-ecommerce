"use client";

import { getApiHeaders } from "@/lib/api-client";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

export type RealtimeConfig = {
	key: string;
	cluster: string;
	authEndpoint: string;
	token: string;
};

let activeEcho: Echo<"pusher"> | null = null;
let activeSignature: string | null = null;

export const getRealtimeEcho = (config: RealtimeConfig) => {
	const signature = JSON.stringify(config);

	if (activeEcho && activeSignature === signature) {
		return activeEcho;
	}

	if (activeEcho) {
		activeEcho.disconnect();
	}

	((window as unknown) as Window & { Pusher: typeof Pusher }).Pusher = Pusher;

	activeEcho = new Echo({
		broadcaster: "pusher",
		key: config.key,
		cluster: config.cluster,
		forceTLS: true,
		enabledTransports: ["ws", "wss"],
		authEndpoint: config.authEndpoint,
		auth: {
			headers: getApiHeaders({
				Authorization: `Bearer ${config.token}`,
			}),
		},
	});
	activeSignature = signature;

	return activeEcho;
};

export const disconnectRealtimeEcho = () => {
	if (!activeEcho) {
		return;
	}

	activeEcho.disconnect();
	activeEcho = null;
	activeSignature = null;
};

export const getRealtimeSocketId = () => activeEcho?.socketId() || undefined;
