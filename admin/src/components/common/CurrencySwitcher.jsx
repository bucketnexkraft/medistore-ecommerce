import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getCurrency, updateCompanyPreference } from "../../api/companyPreferances";
import { setCurrency } from "../../slice/preferencesSlice";
import { setPriceCurrency } from "../../hooks/currency";

let currencyCache;
let currencyRequest;
let cachedAt = 0;

function loadCurrencies(token) {
  if (currencyCache && Date.now() - cachedAt < 300000) return Promise.resolve(currencyCache);
  if (!currencyRequest) {
    currencyRequest = getCurrency(token).then((result) => {
      currencyCache = result.data;
      cachedAt = Date.now();
      return currencyCache;
    }).finally(() => { currencyRequest = null; });
  }
  return currencyRequest;
}

export default function CurrencySwitcher() {
  const dispatch = useDispatch();
  const { accessToken, company_id } = useSelector((state) => state.auth);
  const currency = useSelector((state) => state.preferences.data?.currency);
  const [currencies, setCurrencies] = useState(currencyCache || []);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const session = useRef({ accessToken, company_id });
  session.current = { accessToken, company_id };

  useEffect(() => {
    let active = true;
    loadCurrencies(accessToken).then((items) => {
      if (active) { setCurrencies(items); setFailed(false); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [accessToken]);

  const changeCurrency = async (event) => {
    const selected = currencies.find((item) => String(item.id) === event.target.value);
    if (!selected || busy.current || String(selected.id) === String(currency?.id)) return;
    busy.current = true;
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("currency", selected.id);
      const result = await updateCompanyPreference(accessToken, payload);
      if (result.status !== "success" && result.status !== 1 && result.status !== true) {
        throw new Error(result.message || "Unable to update currency");
      }
      if (session.current.accessToken !== accessToken || session.current.company_id !== company_id) return;
      setPriceCurrency(selected);
      dispatch(setCurrency(selected));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Unable to update currency");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  return (
    <select
      aria-label="Company currency"
      aria-busy={saving}
      title={failed ? "Currency list unavailable. Focus to retry." : "Company currency"}
      className="select select-bordered h-10 min-h-10 w-28 rounded-lg border-slate-200 bg-white text-sm text-slate-700 disabled:opacity-60"
      value={currency?.id || ""}
      disabled={saving}
      onFocus={() => {
        if (failed) loadCurrencies(accessToken).then((items) => {
          setCurrencies(items); setFailed(false);
        }).catch(() => setFailed(true));
      }}
      onChange={changeCurrency}
    >
      {!currencies.some((item) => String(item.id) === String(currency?.id)) && (
        <option value={currency?.id || ""}>{currency?.code || "Currency"}</option>
      )}
      {currencies.map((item) => (
        <option key={item.id} value={item.id}>{item.code} ({item.symbol})</option>
      ))}
    </select>
  );
}
