import React, { useState } from "react";
import axios from "axios";

const PasswordUpdate = () => {
  const [form, setForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.new_password !== form.confirm_password) {
      setMessage({ type: "error", text: "New password and confirm password do not match." });
      return;
    }

    try {
      setLoading(true);
      setMessage({});

      const res = await axios.post(
        "/api/update-password",
        {
          current_password: form.current_password,
          new_password: form.new_password,
        },
        {
          headers: {
            Authorization: `Bearer YOUR_TOKEN`, // replace with actual token logic
          },
        }
      );

      setMessage({ type: "success", text: res.data.message || "Password updated successfully." });
      setForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.message || "Something went wrong.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-base-100 shadow-xl rounded-xl">
      <h2 className="text-xl font-bold mb-4">Update Password</h2>

      {message.text && (
        <div
          className={`alert ${message.type === "success" ? "alert-success" : "alert-error"} mb-4`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current Password</label>
          <input
            type="password"
            name="current_password"
            value={form.current_password}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <label className="label">New Password</label>
          <input
            type="password"
            name="new_password"
            value={form.new_password}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
        </div>

        <div>
          <label className="label">Confirm New Password</label>
          <input
            type="password"
            name="confirm_password"
            value={form.confirm_password}
            onChange={handleChange}
            className="input input-bordered w-full"
            required
          />
        </div>

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
};

export default PasswordUpdate;
