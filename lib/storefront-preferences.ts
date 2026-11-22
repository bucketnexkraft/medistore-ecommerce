type PreferenceItem = {
	key?: string;
	value?: unknown;
};

export const normalizePreferencesData = (data: unknown): Record<string, unknown> | null => {
	if (Array.isArray(data)) {
		return data.reduce<Record<string, unknown>>((accumulator, item) => {
			const key = String((item as PreferenceItem | null)?.key || "").trim();

			if (key !== "") {
				accumulator[key] = (item as PreferenceItem).value;
			}

			return accumulator;
		}, {});
	}

	if (data && typeof data === "object") {
		return data as Record<string, unknown>;
	}

	return null;
};
