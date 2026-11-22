import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useDispatch } from "react-redux";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { registerCompany } from "../../api/companyOnboarding";
import { setAuthSession } from "../../slice/authSlice";

function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const pricingPath = "/subscription/plans";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async (formData) => {
    try {
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name || "",
        email: formData.email,
        phone: formData.phone,
        company_name: formData.company_name,
        password: formData.password,
        password_confirmation: formData.password_confirmation,
        enable_social_auth: Boolean(formData.enable_social_auth),
      };

      const result = await registerCompany(payload);
      if (!result?.status) throw new Error(result?.message || "Registration failed");

      dispatch(setAuthSession(result));
      toast.success("Registration successful");
      navigate(pricingPath);
    } catch (error) {
      const serverErrors = error?.response?.data?.errors;
      const message = Array.isArray(serverErrors)
        ? serverErrors[0]
        : error?.response?.data?.message || error?.message || "Registration failed";
      toast.error(message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center mb-7">
        <p className="text-xs tracking-[0.16em] uppercase text-pink-600 font-semibold">Create Account</p>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Register Company</h2>
        <p className="text-slate-500 mt-2">Start with a modern inventory workspace in a few steps.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name</label>
          <input
            type="text"
            className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition ${errors.company_name ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
            {...register("company_name", { required: "Company name is required" })}
          />
          {errors.company_name && <p className="text-red-500 text-sm mt-1">{errors.company_name.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
            <input
              type="text"
              className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition ${errors.first_name ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
              {...register("first_name", { required: "First name is required" })}
            />
            {errors.first_name && <p className="text-red-500 text-sm mt-1">{errors.first_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              {...register("last_name")}
            />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            {...register("enable_social_auth")}
          />
          <span className="text-sm text-slate-700">
            Enable social authentication for this company
            <span className="block text-xs text-slate-500 mt-1">
              This keeps Google sign in available as a company preference during onboarding.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
            <input
              type="email"
              className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition ${errors.email ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
              {...register("email", { required: "Email is required" })}
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
            <div className={`rounded-xl border bg-white px-4 py-3 transition ${errors.phone ? "border-red-400" : "border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"}`}>
              <Controller
                name="phone"
                control={control}
                rules={{
                  required: "Phone is required",
                  validate: (value) =>
                    (value && isValidPhoneNumber(value)) || "Enter a valid mobile number",
                }}
                render={({ field }) => (
                  <PhoneInput
                    international
                    defaultCountry="BD"
                    countryCallingCodeEditable={false}
                    placeholder="Enter mobile number"
                    value={field.value}
                    onChange={field.onChange}
                    className="phone-input-clean"
                  />
                )}
              />
            </div>
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className={`w-full rounded-xl border bg-white px-4 py-3 pr-11 outline-none transition ${errors.password ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
                {...register("password", { required: "Password is required", minLength: 6 })}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-600">
                {showPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-sm mt-1">Password must be at least 6 characters.</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                className={`w-full rounded-xl border bg-white px-4 py-3 pr-11 outline-none transition ${errors.password_confirmation ? "border-red-400 focus:ring-2 focus:ring-red-200" : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"}`}
                {...register("password_confirmation", {
                  required: "Please confirm password",
                  validate: (value) => value === watch("password") || "Passwords do not match",
                })}
              />
              <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-600">
                {showConfirmPassword ? <AiFillEyeInvisible size={20} /> : <AiFillEye size={20} />}
              </button>
            </div>
            {errors.password_confirmation && <p className="text-red-500 text-sm mt-1">{errors.password_confirmation.message}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-pink-600 text-white py-3 font-semibold shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-pink-700 transition disabled:opacity-70"
        >
          {isSubmitting ? "Creating..." : "Create Company Account"}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
