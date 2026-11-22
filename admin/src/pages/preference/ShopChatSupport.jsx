import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import { PiArrowLeft, PiCheckCircle } from "react-icons/pi";
import { getPreference } from "../../api/preference";
import { updateCompanyPreference } from "../../api/companyPreferances";

export default function ShopChatSupport() {
  const navigate = useNavigate();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const companyId = useSelector((state) => state.auth.company_id);
  const [chatChannel, setChatChannel] = useState("facebook");
  const [facebookPageId, setFacebookPageId] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadChatSupport = async () => {
      if (!accessToken || !companyId) return;

      try {
        const response = await getPreference(companyId, accessToken);
        const preferences = Array.isArray(response?.data) ? response.data : [];

        const readValue = (key) => {
          const item = preferences.find((entry) => entry?.key === key);
          return typeof item?.value === "string" ? item.value : item?.value || "";
        };

        const storedChannel = String(readValue("chat_support_channel") || "facebook").toLowerCase();
        setChatChannel(storedChannel === "whatsapp" ? "whatsapp" : "facebook");
        setFacebookPageId(String(readValue("facebook_page_id") || ""));
        setWhatsappNumber(String(readValue("whatsapp_number") || ""));
      } catch (error) {
        console.error("Failed to load chat support preferences", error);
      }
    };

    loadChatSupport();
  }, [accessToken, companyId]);

  const saveChatSupport = async () => {
    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append("chat_support_channel", chatChannel);
      formData.append("facebook_page_id", facebookPageId);
      formData.append("whatsapp_number", whatsappNumber);

      await updateCompanyPreference(accessToken, formData);

      Swal.fire({
        icon: "success",
        title: "Success",
        text: "Chat support updated successfully",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update chat support");
    } finally {
      setIsSaving(false);
    }
  };

  const isFacebook = chatChannel === "facebook";

  return (
    <div className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1360px] space-y-6">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/company-preference/shop-setup")}
            className="grid h-14 w-14 place-items-center rounded-full border border-black/10 bg-white text-black shadow-sm transition hover:border-black/20 hover:bg-slate-50"
          >
            <PiArrowLeft size={26} />
          </button>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-black/55">
              Shop Setup
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-black sm:text-4xl">
              Chat Support
            </h1>
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="rounded-[22px] border border-black/10 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/55">
                Channel Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-black">
                Choose how customers contact you
              </h2>
              <p className="mt-3 text-sm leading-6 text-black/70">
                Keep the interface simple. Pick one channel, add its details, then save.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { id: "facebook", label: "Facebook" },
                  { id: "whatsapp", label: "Whatsapp" },
                ].map((option) => {
                  const active = chatChannel === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setChatChannel(option.id)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                        active
                          ? "border-black bg-black text-white"
                          : "border-black/10 bg-white text-black hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex items-center gap-3 text-base font-medium">
                        <PiCheckCircle size={22} />
                        {option.label}
                      </span>
                      <span className={`text-xs uppercase tracking-[0.22em] ${active ? "text-white/70" : "text-black/45"}`}>
                        Active
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[22px] border border-black/10 bg-slate-50 p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/55">
                Quick Notes
              </p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-black/70">
                <li>• Keep only one primary chat channel active for cleaner customer support.</li>
                <li>• Facebook uses a Page ID.</li>
                <li>• WhatsApp uses your business number.</li>
              </ul>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="rounded-[24px] border border-black/10 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-2 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/55">
                    Configuration
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-black">
                    {isFacebook ? "Facebook Chat Setup" : "WhatsApp Chat Setup"}
                  </h2>
                </div>
                <div className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-black/65">
                  {isFacebook ? "Page ID" : "Phone Number"}
                </div>
              </div>

              <div className="mt-6">
                {isFacebook ? (
                  <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                    <div className="rounded-[20px] border border-black/10 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-black">
                        Steps to enable Facebook Chat
                      </h3>
                      <ol className="mt-4 space-y-3 text-sm leading-6 text-black/75">
                        <li>
                          <span className="font-semibold text-black">1. Get Page ID:</span> Go to your page -&gt; About -&gt; Page transparency and copy the Page ID.
                        </li>
                        <li>
                          <span className="font-semibold text-black">2. Paste it here:</span> Save the ID and your chat support will use it for Facebook routing.
                        </li>
                      </ol>
                    </div>

                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-black">
                          Facebook Page ID
                        </span>
                        <input
                          type="text"
                          value={facebookPageId}
                          onChange={(e) => setFacebookPageId(e.target.value)}
                          placeholder="Facebook Page ID"
                          className="h-14 w-full rounded-2xl border border-black/10 bg-white px-5 text-base text-black outline-none transition placeholder:text-black/30 focus:border-black/30 focus:ring-4 focus:ring-black/5"
                        />
                      </label>

                      <div className="rounded-[20px] border border-black/10 bg-slate-50 p-5">
                        <p className="text-sm leading-6 text-black/75">
                          This keeps your contact option minimal and focused, without adding extra colors or visual noise.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
                    <div className="rounded-[20px] border border-black/10 bg-slate-50 p-5">
                      <h3 className="text-lg font-semibold text-black">
                        WhatsApp contact details
                      </h3>
                      <p className="mt-3 text-sm leading-6 text-black/75">
                        Use your official business number so customers can reach support directly.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-black">
                          WhatsApp number (Ex:- +8801*********)
                        </span>
                        <input
                          type="text"
                          value={whatsappNumber}
                          onChange={(e) => setWhatsappNumber(e.target.value)}
                          placeholder="WhatsApp number (Ex:- +8801*********)"
                          className="h-14 w-full rounded-2xl border border-black/10 bg-white px-5 text-base text-black outline-none transition placeholder:text-black/30 focus:border-black/30 focus:ring-4 focus:ring-black/5"
                        />
                      </label>

                      <div className="rounded-[20px] border border-black/10 bg-slate-50 p-5">
                        <p className="text-sm leading-6 text-black/75">
                          Keep the number in international format for cleaner setup and future automation.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={saveChatSupport}
                  className="inline-flex min-h-14 items-center justify-center rounded-2xl border border-black bg-black px-8 py-4 text-base font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-500"
                  disabled={isSaving}
                >
                  {isSaving ? "Updating..." : "Update Chat Support Info"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
