import React from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { PiEye, PiEyeSlash } from "react-icons/pi";
import { API_URL } from "../../config/constants";

const STEP_SEND_EMAIL = 1;
const STEP_VERIFY_CODE = 2;
const STEP_RESET_PASSWORD = 3;

function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = React.useState(STEP_SEND_EMAIL);
  const [email, setEmail] = React.useState("");
  const [resetToken, setResetToken] = React.useState("");
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const emailForm = useForm();
  const codeForm = useForm();
  const resetForm = useForm();
  const newPassword = resetForm.watch("new_password", "");
  const confirmPassword = resetForm.watch("new_password_confirmation", "");
  const [otpDigits, setOtpDigits] = React.useState(["", "", "", "", "", ""]);
  const otpRefs = React.useRef([]);
  const autoSubmittingRef = React.useRef(false);
  const lastAutoSubmittedCodeRef = React.useRef("");

  React.useEffect(() => {
    codeForm.setValue("code", otpDigits.join(""));
  }, [otpDigits, codeForm]);

  React.useEffect(() => {
    if (step !== STEP_VERIFY_CODE || resendCooldown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step, resendCooldown]);

  React.useEffect(() => {
    const fullCode = otpDigits.join("");
    if (step !== STEP_VERIFY_CODE) return;
    if (fullCode.length !== 6 || verifying) return;
    if (autoSubmittingRef.current) return;
    if (lastAutoSubmittedCodeRef.current === fullCode) return;

    autoSubmittingRef.current = true;
    lastAutoSubmittedCodeRef.current = fullCode;
    codeForm.handleSubmit(handleVerifyCode)();
    setTimeout(() => {
      autoSubmittingRef.current = false;
    }, 800);
  }, [otpDigits, step, verifying]); // eslint-disable-line react-hooks/exhaustive-deps

  const extractErrorMessage = (data) => {
    if (!data) return null;
    if (typeof data.message === "string") return data.message;
    if (Array.isArray(data.errors)) return data.errors.join("\n");
    if (typeof data.errors === "object" && data.errors) {
      const messages = Object.values(data.errors).flat().filter(Boolean);
      if (messages.length) return messages.join("\n");
    }
    return null;
  };

  const handleSendEmail = async (formData) => {
    try {
      setSending(true);
      const response = await axios.post(`${API_URL}/forgot-password/request`, {
        email: formData.email,
      });

      if (response?.data?.status === 1) {
        setEmail(String(formData.email || "").trim().toLowerCase());
        setStep(STEP_VERIFY_CODE);
        setOtpDigits(["", "", "", "", "", ""]);
        setResendCooldown(Number(response?.data?.data?.resend_after_seconds || 60));
        toast.success(response?.data?.message || "Verification code sent");
      } else {
        toast.error(response?.data?.message || "Failed to send verification code");
      }
    } catch (error) {
      toast.error(extractErrorMessage(error?.response?.data) || "Failed to send verification code");
    } finally {
      setSending(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || resendCooldown > 0) return;

    try {
      setSending(true);
      const response = await axios.post(`${API_URL}/forgot-password/request`, {
        email,
      });

      if (response?.data?.status === 1) {
        setOtpDigits(["", "", "", "", "", ""]);
        codeForm.reset({ code: "" });
        lastAutoSubmittedCodeRef.current = "";
        setResendCooldown(Number(response?.data?.data?.resend_after_seconds || 60));
        toast.success(response?.data?.message || "Verification code resent");
        otpRefs.current[0]?.focus();
      } else {
        toast.error(response?.data?.message || "Failed to resend verification code");
      }
    } catch (error) {
      const retryAfterSeconds = Number(error?.response?.data?.data?.retry_after_seconds || 0);
      if (retryAfterSeconds > 0) {
        setResendCooldown(retryAfterSeconds);
      }
      toast.error(extractErrorMessage(error?.response?.data) || "Failed to resend verification code");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (formData) => {
    try {
      setVerifying(true);
      const response = await axios.post(`${API_URL}/forgot-password/verify`, {
        email,
        code: formData.code,
      });

      if (response?.data?.status === 1) {
        setResetToken(response?.data?.data?.reset_token || "");
        setStep(STEP_RESET_PASSWORD);
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        toast.success(response?.data?.message || "Email verified");
      } else {
        toast.error(response?.data?.message || "Verification failed");
      }
    } catch (error) {
      toast.error(extractErrorMessage(error?.response?.data) || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleOtpChange = (index, rawValue) => {
    const value = String(rawValue || "").replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = value;
      // Allow re-auto-submit only when user changes the code.
      lastAutoSubmittedCodeRef.current = "";
      return next;
    });
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => {
      next[i] = ch;
    });
    setOtpDigits(next);
    otpRefs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  const handleResetPassword = async (formData) => {
    if (!email || !resetToken) {
      toast.error("Reset session missing. Please verify your code again.");
      setStep(STEP_SEND_EMAIL);
      return;
    }

    try {
      setResetting(true);
      const response = await axios.post(`${API_URL}/forgot-password/reset`, {
        email,
        reset_token: resetToken,
        new_password: formData.new_password,
        new_password_confirmation: formData.new_password_confirmation,
      });

      if (response?.data?.status === 1) {
        toast.success(response?.data?.message || "Password reset successfully");
        navigate("/login");
      } else {
        toast.error(response?.data?.message || "Password reset failed");
      }
    } catch (error) {
      toast.error(extractErrorMessage(error?.response?.data) || "Password reset failed");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center mb-7">
        <p className="text-xs tracking-[0.16em] uppercase text-indigo-600 font-semibold">Account Recovery</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Forgot Password</h2>
        <p className="text-slate-500 mt-2">
          {step === STEP_SEND_EMAIL && "Enter your email to receive a verification code"}
          {step === STEP_VERIFY_CODE && `Enter the 6-digit code sent to ${email}`}
          {step === STEP_RESET_PASSWORD && "Set a strong password to secure your account"}
        </p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-2 text-xs md:text-sm">
        <span className={`px-3 py-1.5 rounded-full ${step >= 1 ? "bg-indigo-100 text-indigo-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>1. Email</span>
        <span className="text-slate-300">-</span>
        <span className={`px-3 py-1.5 rounded-full ${step >= 2 ? "bg-indigo-100 text-indigo-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>2. Verify</span>
        <span className="text-slate-300">-</span>
        <span className={`px-3 py-1.5 rounded-full ${step >= 3 ? "bg-indigo-100 text-indigo-700 font-semibold" : "bg-slate-100 text-slate-500"}`}>3. Reset</span>
      </div>

      {step === STEP_SEND_EMAIL && (
        <form onSubmit={emailForm.handleSubmit(handleSendEmail)} className="space-y-4 max-w-xl mx-auto">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-2">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="you@example.com"
              {...emailForm.register("email", {
                required: "Email is required",
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: "Enter a valid email address",
                },
              })}
              className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition ${emailForm.formState.errors.email ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
            />
            {emailForm.formState.errors.email && (
              <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.email.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-pink-700 transition disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Verification Code"}
          </button>
        </form>
      )}

      {step === STEP_VERIFY_CODE && (
        <form onSubmit={codeForm.handleSubmit(handleVerifyCode)} className="max-w-xl mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-6 md:px-7 md:py-7">
            <label htmlFor="code" className="block text-sm font-semibold text-slate-700 mb-4 text-center">Verification Code</label>
            <div className="flex items-center justify-center gap-2 md:gap-3 mb-5" onPaste={handleOtpPaste}>
              {otpDigits.map((digit, index) => (
                <input
                  key={`otp-${index}`}
                  ref={(el) => (otpRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className={`h-14 w-12 md:h-16 md:w-14 rounded-xl border bg-white text-center text-xl font-semibold outline-none transition ${codeForm.formState.errors.code ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
                />
              ))}
            </div>
            <input
              type="hidden"
              {...codeForm.register("code", {
                required: "Code is required",
                pattern: {
                  value: /^[0-9]{6}$/,
                  message: "Code must be 6 digits",
                },
              })}
            />
            {codeForm.formState.errors.code && (
              <p className="text-red-500 text-sm text-center mb-3">{codeForm.formState.errors.code.message}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                className="w-full rounded-xl border border-slate-300 text-slate-700 py-3 font-semibold hover:bg-slate-50"
                onClick={() => setStep(STEP_SEND_EMAIL)}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={verifying}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-pink-700 transition disabled:opacity-60"
              >
                {verifying ? (
                  <span className="inline-flex items-center gap-2">
                    Verifying
                    <span className="inline-flex items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s] mx-1" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" />
                    </span>
                  </span>
                ) : (
                  "Verify Code"
                )}
              </button>
            </div>

            <div className="mt-4 text-center text-sm text-slate-500">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={sending || resendCooldown > 0}
                className="font-semibold text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                {sending
                  ? "Resending..."
                  : resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Resend code"}
              </button>
            </div>
          </div>
        </form>
      )}

      {step === STEP_RESET_PASSWORD && (
        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4 max-w-xl mx-auto">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
            Resetting password for <span className="font-semibold">{email}</span>
          </div>

          <div>
            <label htmlFor="new_password" className="block text-sm font-semibold text-slate-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                id="new_password"
                placeholder="Enter your new password"
                {...resetForm.register("new_password", {
                  required: "New password is required",
                  minLength: { value: 6, message: "Minimum 6 characters required" },
                })}
                className={`w-full rounded-xl border bg-white px-4 py-3 ${newPassword ? "pr-12" : ""} outline-none transition ${resetForm.formState.errors.new_password ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
              />
              {newPassword ? (
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 inline-flex items-center text-lg text-indigo-600 hover:text-indigo-700"
                >
                  {showNewPassword ? <PiEyeSlash /> : <PiEye />}
                </button>
              ) : null}
            </div>
            {resetForm.formState.errors.new_password && (
              <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="new_password_confirmation" className="block text-sm font-semibold text-slate-700 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="new_password_confirmation"
                placeholder="Confirm your new password"
                {...resetForm.register("new_password_confirmation", {
                  required: "Please confirm your password",
                  validate: (value) => value === newPassword || "Passwords do not match",
                })}
                className={`w-full rounded-xl border bg-white px-4 py-3 ${confirmPassword ? "pr-12" : ""} outline-none transition ${resetForm.formState.errors.new_password_confirmation ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
              />
              {confirmPassword ? (
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-3 inline-flex items-center text-lg text-indigo-600 hover:text-indigo-700"
                >
                  {showConfirmPassword ? <PiEyeSlash /> : <PiEye />}
                </button>
              ) : null}
            </div>
            {resetForm.formState.errors.new_password_confirmation && (
              <p className="text-red-500 text-sm mt-1">{resetForm.formState.errors.new_password_confirmation.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={resetting}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-pink-700 transition disabled:opacity-60"
          >
            {resetting ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}

      <p className="text-center text-sm mt-6">
        <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
          Back to Login
        </Link>
      </p>
    </div>
  );
}

export default ForgotPassword;
