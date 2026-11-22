import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { PiEnvelopeSimple, PiMagnifyingGlass, PiTrash } from "react-icons/pi";
import { deleteNewsletter, getNewsletters, sendNewsletterEmail } from "../../../api/backoffice/communications";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function Newsletters() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [composeSubscriber, setComposeSubscriber] = useState(null);
  const [mailForm, setMailForm] = useState({ subject: "", message: "" });
  const [sendingMail, setSendingMail] = useState(false);

  const loadData = useCallback(async (nextSearch = search) => {
    setLoading(true);
    try {
      const result = await getNewsletters(accessToken, { search: nextSearch, perPage: 200 });
      if (!result?.status) throw new Error(result?.message || "Failed to load newsletter subscriptions");
      setRows(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load newsletter subscriptions");
    } finally {
      setLoading(false);
    }
  }, [accessToken, search]);

  useEffect(() => {
    if (!accessToken) return;
    loadData("");
  }, [accessToken, loadData]);

  const handleSearch = () => {
    const nextSearch = keyword.trim();
    setSearch(nextSearch);
    loadData(nextSearch);
  };

  const resetSearch = () => {
    setKeyword("");
    setSearch("");
    loadData("");
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: "Delete Subscription?",
      text: `You are deleting the subscription for "${row.email}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteNewsletter(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Newsletter subscription deleted");
      loadData(search);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  const openCompose = (row) => {
    setComposeSubscriber(row);
    setMailForm({ subject: "", message: "" });
  };

  const closeCompose = () => {
    if (sendingMail) return;
    setComposeSubscriber(null);
    setMailForm({ subject: "", message: "" });
  };

  const handleSendMail = async () => {
    if (!composeSubscriber) return;

    setSendingMail(true);
    try {
      const response = await sendNewsletterEmail(accessToken, composeSubscriber.id, mailForm);
      if (!response?.status) throw new Error(response?.message || "Email send failed");
      toast.success("Newsletter email sent successfully");
      setComposeSubscriber(null);
      setMailForm({ subject: "", message: "" });
    } catch (error) {
      const errors = error?.response?.data?.errors;
      toast.error(Array.isArray(errors) ? errors[0] : error?.response?.data?.message || error?.message || "Email send failed");
    } finally {
      setSendingMail(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div>
          <h2 className="text-xl font-semibold">Newsletter Subscribers</h2>
          <p className="text-sm text-gray-600">Manage emails collected from the footer subscription form.</p>
        </div>

        <div className="w-full max-w-3xl mt-4">
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-28 focus:outline-none focus:border-none"
                placeholder="Search by email..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <div className="absolute right-1 flex items-center gap-1">
                <button onClick={handleSearch} className="text-gray-500 hover:text-primary px-1 py-2" title="Search">
                  <PiMagnifyingGlass className="w-5 h-5" />
                </button>
                <button onClick={resetSearch} className="btn btn-ghost btn-sm normal-case">Reset</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="bg-gray-100">
                <th>Email</th>
                <th>Subscribed</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length ? (
                <tr><td colSpan={3} className="text-center py-8">No newsletter subscriptions found.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.email || "-"}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        className="btn btn-sm border-none bg-primary/10 text-primary"
                        onClick={() => openCompose(row)}
                        title="Send Email"
                      >
                        <PiEnvelopeSimple />
                      </button>
                      <button className="btn btn-sm border-none bg-error/10 text-error" onClick={() => handleDelete(row)}>
                        <PiTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {composeSubscriber && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Send Newsletter Email</h3>
                <p className="text-sm text-gray-600 mt-1 break-all">{composeSubscriber.email}</p>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={closeCompose} disabled={sendingMail}>
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="label py-1"><span className="label-text font-medium">Subject</span></label>
                <input
                  className="input input-bordered w-full"
                  value={mailForm.subject}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                  disabled={sendingMail}
                />
              </div>
              <div>
                <label className="label py-1"><span className="label-text font-medium">Message</span></label>
                <textarea
                  className="textarea textarea-bordered w-full min-h-48"
                  value={mailForm.message}
                  onChange={(e) => setMailForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Write the email message..."
                  disabled={sendingMail}
                />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={closeCompose} disabled={sendingMail}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSendMail} disabled={sendingMail}>
                {sendingMail ? "Sending..." : "Send Email"}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={closeCompose} />
        </div>
      )}
    </div>
  );
}
