import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBackendLanguages, loadLanguagePack } from "../../i18n";

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const list = await getBackendLanguages({ forceRefresh: true });
        setLanguages(Array.isArray(list) ? list : []);
      } catch {
        setLanguages([]);
      }
    };

    load();
  }, []);

  const selectedCode = useMemo(() => {
    const lang = String(i18n.language || "en").toLowerCase();
    const direct = languages.find((item) => String(item.code).toLowerCase() === lang);
    if (direct) return direct.code;

    const short = lang.split("-")[0];
    const shortMatch = languages.find((item) => String(item.code).toLowerCase() === short);
    return shortMatch ? shortMatch.code : "en";
  }, [i18n.language, languages]);

  const handleLanguageChange = async (e) => {
    await loadLanguagePack(e.target.value, { forceRefresh: true });
  };

  const refreshLanguages = async () => {
    try {
      const list = await getBackendLanguages({ forceRefresh: true });
      setLanguages(Array.isArray(list) ? list : []);
    } catch {
      // keep existing list on refresh failure
    }
  };

  return (
    <div>
      <select
        value={selectedCode}
        onChange={handleLanguageChange}
        onFocus={refreshLanguages}
        className="select select-bordered w-full max-w-xs focus:outline-none"
      >
        {languages.length === 0 && <option value="en">English (EN)</option>}
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name} ({String(lang.code).toUpperCase()})
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;
