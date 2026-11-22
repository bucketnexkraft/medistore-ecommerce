import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import { PiEnvelopeSimple, PiEye, PiMagnifyingGlass, PiTrash } from "react-icons/pi";
import {
  deleteContactMessage,
  getContactMessageById,
  getContactMessages,
  sendContactMessageEmail,
} from "../../../api/backoffice/communications";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function ContactMessages() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [search, setSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [composeContact, setComposeContact] = useState(null);
  const [mailForm, setMailForm] = useState({ subject: "", message: "" });
  const [sendingMail, setSendingMail] = useState(false);

  const loadData = useCallback(async (nextSearch = search) => {
    setLoading(true);
    try {
      const result = await getContactMessages(accessToken, { search: nextSearch, perPage: 200 });
      if (!result?.status) throw new Error(result?.message || "Failed to load contact messages");
      setRows(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load contact messages");
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

  const handleView = async (row) => {
    setViewLoading(true);
    try {
      const result = await getContactMessageById(accessToken, row.id);
      if (!result?.status) throw new Error(result?.message || "Failed to load contact message");
      setSelectedMessage(result?.data || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to load contact message");
    } finally {
      setViewLoading(false);
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: "Delete Contact Message?",
      text: `You are deleting the message from "${row.name}".`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteContactMessage(accessToken, row.id);
      if (!response?.status) throw new Error(response?.message || "Delete failed");
      toast.success("Contact message deleted");
      if (selectedMessage?.id === row.id) setSelectedMessage(null);
      loadData(search);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Delete failed");
    }
  };

  const openCompose = (row) => {
    setComposeContact(row);
    setMailForm({
      subject: row.subject ? `Re: ${row.subject}` : "",
      message: "",
    });
  };

  const closeCompose = () => {
    if (sendingMail) return;
    setComposeContact(null);
    setMailForm({ subject: "", message: "" });
  };

  const handleSendMail = async () => {
    if (!composeContact) return;

    setSendingMail(true);
    try {
      const response = await sendContactMessageEmail(accessToken, composeContact.email, mailForm);
      if (!response?.status) throw new Error(response?.message || "Email send failed");
      toast.success("Contact email sent successfully");
      setComposeContact(null);
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
          <h2 className="text-xl font-semibold">Contact Messages</h2>
          <p className="text-sm text-gray-600">Review contact form submissions from the landing pages.</p>
        </div>

        <div className="w-full max-w-3xl mt-4">
          <div className="rounded-lg border">
            <div className="relative flex items-center">
              <input
                type="text"
                className="input w-full pr-28 focus:outline-none focus:border-none"
                placeholder="Search by name, email, subject or message..."
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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.3fr)_minmax(360px,0.7fr)] gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 overflow-x-auto">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <table className="table">
              <thead>
                <tr className="bg-gray-100">
                  <th>Name</th>
                  <th>Email</th>
                  <th>Subject</th>
                  <th>Received</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {!rows.length ? (
                  <tr><td colSpan={5} className="text-center py-8">No contact messages found.</td></tr>
                ) : rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name || "-"}</td>
                    <td>{row.email || "-"}</td>
                    <td className="max-w-[240px] truncate">{row.subject || "-"}</td>
                    <td>{formatDateTime(row.created_at)}</td>
                    <td>
                      <div className="flex items-center justify-center gap-2">
                        <button className="btn btn-sm border-none bg-primary/10 text-primary" onClick={() => handleView(row)}>
                          <PiEye />
                        </button>
                        <button
                          className="btn btn-sm border-none bg-success/10 text-success"
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

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-lg font-semibold mb-1">Message Details</h3>
          <p className="text-sm text-gray-600 mb-4">Open a message from the list to see the full submission.</p>

          {viewLoading ? (
            <p>Loading message...</p>
          ) : !selectedMessage ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Select a contact message to inspect the full content.
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Name</p>
                <p className="font-medium text-slate-800">{selectedMessage.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                <p className="font-medium text-slate-800 break-all">{selectedMessage.email || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Subject</p>
                <p className="font-medium text-slate-800">{selectedMessage.subject || "-"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Received</p>
                <p className="font-medium text-slate-800">{formatDateTime(selectedMessage.created_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Message</p>
                <div className="mt-1 rounded-lg border bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {selectedMessage.message || "-"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {composeContact && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Send Contact Email</h3>
                <p className="text-sm text-gray-600 mt-1 break-all">{composeContact.email}</p>
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
