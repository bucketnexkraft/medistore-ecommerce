import { useState } from "react";
import { PiArrowLeft, PiArrowRight, PiCheck, PiCopy, PiRepeat } from "react-icons/pi";

const initialChecks = {
  root: { description: "Waiting to check the root domain", state: "idle", label: "Waiting" },
  txt: { description: "Waiting to verify domain ownership", state: "idle", label: "Waiting" },
  cname: { description: "Waiting to verify storefront routing", state: "idle", label: "Waiting" },
  resolve: { description: "Waiting to resolve the www address", state: "idle", label: "Waiting" },
  https: { description: "Browser-level HTTPS reachability check", state: "idle", label: "Waiting" },
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const normalizeDomain = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

const validDomain = (value) => /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);

const cleanDnsValue = (value) => String(value || "").trim().replace(/^"(.*)"$/, "$1").replace(/\.$/, "");

const statusClass = (state) =>
  state === "ok" ? "bg-[#e8f7ee] text-[#187844]" : state === "bad" ? "bg-[#fdecec] text-[#b42318]" : state === "skip" ? "bg-[#eef0f4] text-[#606672]" : "bg-[#fff4d6] text-[#795b06]";

const createVerificationToken = (domain) => {
  const key = `store-domain-verification:${domain}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const random = typeof window.crypto?.randomUUID === "function"
    ? window.crypto.randomUUID().replace(/-/g, "")
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const token = `verify=${random.slice(0, 24)}`;
  window.localStorage.setItem(key, token);
  return token;
};

const lookupDns = async (name, type) => {
  const response = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { Accept: "application/dns-json" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`DNS lookup failed with status ${response.status}.`);
  return response.json();
};

export default function CustomDomainFlow({
  initialDomain = "",
  initialStoreName = "",
  platformTarget,
  saving,
  saveError,
  validateStore,
  onConnect,
}) {
  const [step, setStep] = useState(1);
  const [domainInput, setDomainInput] = useState(initialDomain);
  const [domain, setDomain] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [validating, setValidating] = useState(false);
  const [checks, setChecks] = useState(initialChecks);

  const platformDomain = normalizeDomain(platformTarget);
  const target = `${slugify(initialStoreName)}.${platformDomain}`;
  const txtHost = domain ? `_storeverify.${domain}` : "_storeverify";
  const storefrontHost = domain ? `www.${domain}` : "www";
  const requiredPassed = checks.txt.state === "ok" && checks.cname.state === "ok";

  const continueToDns = async () => {
    const normalizedDomain = normalizeDomain(domainInput);
    if (!slugify(initialStoreName)) {
      setError("Enter your existing store name first.");
      return;
    }
    if (!validDomain(normalizedDomain)) {
      setError("Enter a valid root domain, for example yourbrand.com.");
      return;
    }
    setValidating(true);
    setError("");
    try {
      const result = await validateStore(target);
      if (!result.valid) {
        setError(result.message || "This store name is not available.");
        return;
      }
      setDomain(normalizedDomain);
      setDomainInput(normalizedDomain);
      setVerificationToken(createVerificationToken(normalizedDomain));
      setChecks(initialChecks);
      setStep(2);
    } catch (caughtError) {
      setError(caughtError?.message || "Unable to validate this store.");
    } finally {
      setValidating(false);
    }
  };

  const verifyDomain = async () => {
    if (!domain || !verificationToken || checking) return;
    setStep(3);
    setChecking(true);
    setError("");
    setChecks({
      root: { description: domain, state: "checking", label: "Checking..." },
      txt: { description: `${txtHost} = ${verificationToken}`, state: "checking", label: "Checking..." },
      cname: { description: `${storefrontHost} -> ${target}`, state: "checking", label: "Checking..." },
      resolve: { description: storefrontHost, state: "checking", label: "Checking..." },
      https: { description: `https://${storefrontHost}`, state: "checking", label: "Checking..." },
    });
    try {
      const [root, txt, cname, www] = await Promise.all([
        lookupDns(domain, "A"),
        lookupDns(txtHost, "TXT"),
        lookupDns(storefrontHost, "CNAME"),
        lookupDns(storefrontHost, "A"),
      ]);
      const rootValues = (root.Answer || []).filter((item) => item.type === 1).map((item) => cleanDnsValue(item.data));
      const txtValues = (txt.Answer || []).filter((item) => item.type === 16).map((item) => cleanDnsValue(item.data));
      const cnameValues = (cname.Answer || []).filter((item) => item.type === 5).map((item) => cleanDnsValue(item.data).toLowerCase());
      const wwwValues = (www.Answer || []).filter((item) => item.type === 1).map((item) => cleanDnsValue(item.data));
      setChecks({
        root: { description: rootValues.length ? `${domain} -> ${rootValues.join(", ")}` : domain, state: rootValues.length ? "ok" : "bad", label: rootValues.length ? "Resolves" : "Not resolved" },
        txt: { description: `${txtHost} = ${verificationToken}`, state: txtValues.some((value) => value.includes(verificationToken)) ? "ok" : "bad", label: txtValues.some((value) => value.includes(verificationToken)) ? "Verified" : txtValues.length ? "Mismatch" : "Not found" },
        cname: { description: cnameValues.length ? `${storefrontHost} -> ${cnameValues.join(", ")}` : `${storefrontHost} -> ${target}`, state: cnameValues.some((value) => value === target.toLowerCase()) ? "ok" : "bad", label: cnameValues.some((value) => value === target.toLowerCase()) ? "Connected" : cnameValues.length ? "Mismatch" : "Not found" },
        resolve: { description: wwwValues.length ? `${storefrontHost} -> ${wwwValues.join(", ")}` : storefrontHost, state: wwwValues.length ? "ok" : "bad", label: wwwValues.length ? "Resolves" : "Not resolved" },
        https: { description: `https://${storefrontHost}`, state: "skip", label: "Not ready" },
      });
      try {
        await fetch(`https://${storefrontHost}/`, { method: "HEAD", mode: "no-cors", cache: "no-store" });
        setChecks((current) => ({ ...current, https: { description: `https://${storefrontHost}`, state: "ok", label: "Reachable" } }));
      } catch {
        return undefined;
      }
    } catch (caughtError) {
      setError(caughtError?.message || "Unable to verify DNS right now.");
      setChecks((current) => Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value.state === "checking" ? { ...value, state: "bad", label: "Error" } : value])));
    } finally {
      setChecking(false);
    }
  };

  const copyValue = async (value) => navigator.clipboard?.writeText(value);
  const labels = ["Enter domain", "DNS setup", "Verify"];

  return (
    <div className="mt-6 overflow-hidden rounded-[18px] border border-[#ece7f5] bg-white">
      <div className="border-b border-[#ece7f5] bg-[linear-gradient(135deg,#fbf9ff_0%,#ffffff_62%,#f4faf7_100%)] px-5 py-6 sm:px-7">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7c3aed]">Custom storefront</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.04em] text-[#212124]">Connect your custom domain</h2>
        <p className="mt-2 max-w-[660px] text-[12px] leading-5 text-[#72727e]">Prove ownership, route your www address to the platform, and connect only after the required DNS records match.</p>
      </div>
      <div className="px-5 pt-6 sm:px-7">
        <div className="grid gap-3 sm:grid-cols-3">
          {labels.map((label, index) => {
            const number = index + 1;
            return <div key={label} className={`flex items-center gap-2 text-[11px] font-semibold ${step >= number ? "text-[#212124]" : "text-[#9a9aa7]"}`}><span className={`inline-flex size-7 items-center justify-center rounded-full border ${step === number ? "border-[#212124] bg-[#212124] text-white" : step > number ? "border-[#cdbbfa] bg-[#f4edff] text-[#7c3aed]" : "border-[#e3e3e9] bg-white"}`}>{step > number ? <PiCheck className="size-3.5" /> : number}</span>{label}</div>;
          })}
        </div>
        <div className="mt-5 h-1 overflow-hidden rounded-full bg-[#f0edf5]"><div className="h-full rounded-full bg-[#7c3aed] transition-[width]" style={{ width: `${step * 33.333}%` }} /></div>
      </div>
      <div className="p-5 sm:p-7">
        {step === 1 ? (
          <div>
            <h3 className="text-[16px] font-semibold text-[#212124]">Enter your custom domain</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#8b8ba3]">Enter the custom domain you own. Your existing store address will remain unchanged.</p>
            <label className="mt-5 block text-[12px] font-semibold text-[#212124]">Custom root domain</label>
            <input type="text" value={domainInput} onChange={(event) => setDomainInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void continueToDns()} placeholder="yourbrand.com" className="mt-2 h-12 w-full rounded-[12px] border border-[#ded9e8] bg-[#fcfcfd] px-4 text-[14px] font-medium text-[#212124] outline-none focus:border-[#9f7aea]" />
            <div className="mt-7 flex justify-end"><button type="button" onClick={() => void continueToDns()} disabled={validating} className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-5 py-3 text-[12px] font-semibold text-white shadow-[0_12px_28px_rgba(124,58,237,0.24)] disabled:opacity-50">{validating ? "Validating store..." : "Continue"}<PiArrowRight className="size-3.5" /></button></div>
          </div>
        ) : null}
        {step === 2 ? (
          <div>
            <h3 className="text-[16px] font-semibold text-[#212124]">Configure DNS records</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#8b8ba3]">Add both records at your DNS provider. Existing matching records do not need to be changed.</p>
            <div className="mt-4 rounded-[12px] border border-[#d8c6ff] bg-[#f7f3ff] px-4 py-3 text-[11px] leading-5 text-[#5b3da8]">Your storefront domain will remain <strong>https://{storefrontHost}</strong>. The CNAME value <strong>{target}</strong> is the platform destination.</div>
            <div className="mt-5 overflow-hidden rounded-[14px] border border-[#e6e3eb]"><div className="grid gap-3 bg-[#f8f7fa] px-4 py-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#72727e] sm:grid-cols-[74px_220px_1fr_auto]"><span>Type</span><span>Record name</span><span>Points to / value</span><span /></div>{[{ type: "TXT", host: txtHost, value: verificationToken }, { type: "CNAME", host: storefrontHost, value: target }].map((record) => <div key={record.type} className="grid gap-3 border-t border-[#eceaf0] px-4 py-4 sm:grid-cols-[74px_220px_1fr_auto] sm:items-center"><strong className="text-[11px] text-[#212124]">{record.type}</strong><code className="break-all rounded-lg bg-[#f4f3f7] px-3 py-2 text-[11px] text-[#4f4f59]">{record.host}</code><code className="break-all rounded-lg bg-[#f4f3f7] px-3 py-2 text-[11px] text-[#4f4f59]">{record.value}</code><button type="button" onClick={() => void copyValue(record.value)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#eeecf2] px-3 py-2 text-[10px] font-semibold text-[#4f4f59]"><PiCopy className="size-3.5" />Copy</button></div>)}</div>
            <div className="mt-4 rounded-[12px] border border-[#f0dda6] bg-[#fff9e8] px-4 py-3 text-[11px] leading-5 text-[#6d5721]">DNS propagation can take several minutes or longer. Verification requires the exact TXT token and CNAME target above.</div>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setStep(1)} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ded9e8] px-5 py-3 text-[12px] font-semibold text-[#4f4f59]"><PiArrowLeft className="size-3.5" />Back</button><button type="button" onClick={() => void verifyDomain()} disabled={!target} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7c3aed] px-5 py-3 text-[12px] font-semibold text-white">Verify DNS<PiArrowRight className="size-3.5" /></button></div>
          </div>
        ) : null}
        {step === 3 ? (
          <div>
            <h3 className="text-[16px] font-semibold text-[#212124]">Verification results</h3>
            <p className="mt-2 text-[11px] leading-5 text-[#8b8ba3]">Required and diagnostic checks are shown independently.</p>
            <div className="mt-5 overflow-hidden rounded-[14px] border border-[#e6e3eb]">{[["root", "Root domain exists", false], ["txt", "TXT ownership", true], ["cname", "Exact CNAME routing", true], ["resolve", "www resolves", false], ["https", "HTTPS reachable", false]].map(([key, label, required], index) => { const check = checks[key]; return <div key={key} className={`flex items-center justify-between gap-4 px-4 py-4 ${index ? "border-t border-[#eceaf0]" : ""}`}><div className="min-w-0"><p className="text-[12px] font-semibold text-[#212124]">{index + 1}. {label} {required ? <span className="text-[#7c3aed]">(required)</span> : null}</p><p className="mt-1 break-all font-mono text-[10px] leading-4 text-[#858590]">{check.description}</p></div><span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-semibold ${statusClass(check.state)}`}>{check.label}</span></div>; })}</div>
            {!checking ? <div className={`mt-4 rounded-[12px] border px-4 py-3 text-[11px] font-medium leading-5 ${requiredPassed ? "border-[#cbead8] bg-[#eaf8f0] text-[#17663c]" : "border-[#f0cfcb] bg-[#fff0ef] text-[#9b2d23]"}`}>{requiredPassed ? "Required checks passed. This domain is ready to connect to your storefront." : "The TXT ownership and exact CNAME records must both match before connecting."}</div> : null}
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setStep(2)} disabled={checking || saving} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ded9e8] px-5 py-3 text-[12px] font-semibold text-[#4f4f59] disabled:opacity-50"><PiArrowLeft className="size-3.5" />DNS records</button><button type="button" onClick={() => void verifyDomain()} disabled={checking || saving} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#cdbbfa] bg-[#f4edff] px-5 py-3 text-[12px] font-semibold text-[#7c3aed]"><PiRepeat className="size-3.5" />{checking ? "Checking..." : "Verify again"}</button><button type="button" onClick={() => void onConnect({ customDomain: storefrontHost, storeDomain: target, verificationToken })} disabled={!requiredPassed || checking || saving} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#212124] px-5 py-3 text-[12px] font-semibold text-white disabled:opacity-40">{saving ? "Connecting..." : "Connect domain"}<PiArrowRight className="size-3.5" /></button></div>
          </div>
        ) : null}
        {error || saveError ? <p className="mt-4 text-right text-[11px] font-medium text-[#b42318]">{error || saveError}</p> : null}
      </div>
    </div>
  );
}
