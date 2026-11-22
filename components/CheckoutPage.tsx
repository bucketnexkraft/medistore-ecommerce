"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface CheckoutFormData {
	email: string;
	country: string;
	firstName: string;
	lastName: string;
	phone: string;
	address: string;
	apartment: string;
	city: string;
	postCode: string;
	saveInfo: boolean;
	couponCode: string;
	// step 3
	shippingMethod: "standard" | "express" | "overnight";
	// step 4
	paymentMethod: "creditCard" | "cod";
	cardNumber: string;
	cardName: string;
	cardExpiry: string;
	cardCVV: string;
	billingAddress: "same" | "different";
	billingCountry: string;
	billingFirstName: string;
	billingLastName: string;
	billingPhone: string;
	billingAddress1: string;
	billingApartment: string;
	billingCity: string;
	billingPostCode: string;
}

export default function CheckoutPage() {
	const initialFormData: CheckoutFormData = {
		email: "",
		country: "",
		firstName: "",
		lastName: "",
		phone: "",
		address: "",
		apartment: "",
		city: "",
		postCode: "",
		saveInfo: false,
		couponCode: "",
		shippingMethod: "standard",
		paymentMethod: "cod",
		cardNumber: "",
		cardName: "",
		cardExpiry: "",
		cardCVV: "",
		billingAddress: "same",
		billingCountry: "",
		billingFirstName: "",
		billingLastName: "",
		billingPhone: "",
		billingAddress1: "",
		billingApartment: "",
		billingCity: "",
		billingPostCode: "",
	};
	const [formData, setFormData] = useState<CheckoutFormData>(initialFormData);

	const [couponApplied, setCouponApplied] = useState(false);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value, type, checked } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: type === "checkbox" ? checked : value,
		}));
	};

	const handleApplyCoupon = () => {
		if (formData.couponCode.trim()) {
			setCouponApplied(true);
		}
	};

	const subtotal = 2500;
	// const shipping = 100;
	const shippingCosts = {
		standard: 100,
		express: 250,
		overnight: 500,
	};
	const shipping = shippingCosts[formData.shippingMethod];
	const discount = couponApplied ? 250 : 0;
	const vat = ((subtotal + shipping - discount) * 0) / 100;
	const total = subtotal + shipping + vat - discount;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		console.log("Checkout form submitted:", formData);
		// Handle order submission

		// ✅ Show alert
		alert("Order placed successfully!");

		// ✅ Reset form fields
		setFormData(initialFormData);

		// ✅ Reset coupon if needed
		setCouponApplied(false);
	};

	return (
		<main className="min-h-screen">
			<div className="section py-8 lg:py-12">
				{/* Main Content - Left and Right */}
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
					{/* Left Section - Form */}
					<div className="order-2 lg:order-1">
						<form onSubmit={handleSubmit} className="space-y-8">
							{/* Contact Section */}
							<div>
								<div className="flex items-center justify-between mb-8">
									<h2 className="font-medium">1. Contact</h2>
									<Link href="/login" className="underline text-primary-black font-medium">
										Log In
									</Link>
								</div>

								<div>
									<input
										type="email"
										name="email"
										placeholder="Email"
										value={formData.email}
										onChange={handleInputChange}
										required
										className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
									/>
								</div>
							</div>

							{/* Delivery Section */}
							<div>
								<h2 className="font-medium mb-8">2. Delivery</h2>
								<div className="space-y-6">
									{/* Country */}
									<div>
										<input
											type="text"
											name="country"
											placeholder="Country"
											value={formData.country}
											onChange={handleInputChange}
											required
											className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* First Name & Last Name */}
									<div className="grid grid-cols-2 gap-4">
										<input
											type="text"
											name="firstName"
											placeholder="First Name"
											value={formData.firstName}
											onChange={handleInputChange}
											required
											className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
										<input
											type="text"
											name="lastName"
											placeholder="Last Name"
											value={formData.lastName}
											onChange={handleInputChange}
											required
											className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* Phone */}
									<div>
										<input
											type="tel"
											name="phone"
											placeholder="Bangladesh +880"
											value={formData.phone}
											onChange={handleInputChange}
											required
											className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* Address */}
									<div>
										<input
											type="text"
											name="address"
											placeholder="Address"
											value={formData.address}
											onChange={handleInputChange}
											required
											className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* Apartment */}
									<div>
										<input
											type="text"
											name="apartment"
											placeholder="Apartment, Suit (Optional)"
											value={formData.apartment}
											onChange={handleInputChange}
											className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* City & Post Code */}
									<div className="grid grid-cols-2 gap-4">
										<input
											type="text"
											name="city"
											placeholder="City"
											value={formData.city}
											onChange={handleInputChange}
											required
											className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
										<input
											type="text"
											name="postCode"
											placeholder="Post code"
											value={formData.postCode}
											onChange={handleInputChange}
											required
											className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
										/>
									</div>

									{/* Save Info Checkbox */}
									<div className="flex items-center gap-3 pt-4">
										<input
											type="checkbox"
											id="saveInfo"
											name="saveInfo"
											checked={formData.saveInfo}
											onChange={handleInputChange}
											className="w-4 h-4 cursor-pointer"
										/>
										<label htmlFor="saveInfo" className="cursor-pointer">
											Save this information for next time
										</label>
									</div>

									{/* Shipping Method Section */}
									<div>
										<h2 className="font-medium mb-8">3. Shipping method</h2>

										<div className="space-y-4">
											{/* Standard Shipping */}
											<label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
												<div className="flex items-center gap-3">
													<input
														type="radio"
														name="shippingMethod"
														value="standard"
														checked={formData.shippingMethod === "standard"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span>Standard Shipping</span>
												</div>
												<span>TK 100</span>
											</label>

											{/* Express Shipping */}
											<label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
												<div className="flex items-center gap-3">
													<input
														type="radio"
														name="shippingMethod"
														value="express"
														checked={formData.shippingMethod === "express"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span>Express Shipping</span>
												</div>
												<span>TK 250</span>
											</label>

											{/* Overnight Shipping */}
											<label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
												<div className="flex items-center gap-3">
													<input
														type="radio"
														name="shippingMethod"
														value="overnight"
														checked={formData.shippingMethod === "overnight"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span>Overnight Shipping</span>
												</div>
												<span>TK 500</span>
											</label>
										</div>
									</div>

									{/* Payment Section */}
									<div>
										<div className="mb-8">
											<h2 className="font-medium mb-2">4. Payment</h2>
											<p className="text-sm text-gray-600">All transactions are secure and encrypted.</p>
										</div>

										{/* Payment Method Options */}
										<div className="space-y-3 mb-8">
											{/* Credit Card */}
											<label className="flex items-center justify-between p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
												<div className="flex items-center gap-3">
													<input
														type="radio"
														name="paymentMethod"
														value="creditCard"
														checked={formData.paymentMethod === "creditCard"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span>Credit Card</span>
												</div>
												<div className="flex gap-2">
													<Image src="/images/checkout/bank1.png" alt="bank 1" width={42} height={26} />
													<Image src="/images/checkout/bank2.png" alt="bank 2" width={42} height={26} />
													<Image src="/images/checkout/bank3.png" alt="bank 3" width={42} height={26} />
													<Image src="/images/checkout/bank4.png" alt="bank 4" width={42} height={26} />
												</div>
											</label>

											{/* Credit Card Fields */}
											{formData.paymentMethod === "creditCard" && (
												<div className="bg-white border border-gray-300 rounded-lg  p-6 space-y-6">
													<div>
														<input
															type="text"
															name="cardNumber"
															placeholder="Card Number"
															value={formData.cardNumber}
															onChange={handleInputChange}
															className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
														/>
													</div>

													<div>
														<input
															type="text"
															name="cardName"
															placeholder="Name on card"
															value={formData.cardName}
															onChange={handleInputChange}
															className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
														/>
													</div>

													<div className="grid grid-cols-2 gap-4">
														<input
															type="text"
															name="cardExpiry"
															placeholder="MM/YY"
															value={formData.cardExpiry}
															onChange={handleInputChange}
															// maxLength="5"
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
														/>
														<input
															type="text"
															name="cardCVV"
															placeholder="Security code"
															value={formData.cardCVV}
															onChange={handleInputChange}
															// maxLength="4"
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400"
														/>
													</div>
												</div>
											)}

											{/* Cash on Delivery */}
											<label className="flex items-center gap-3 p-4 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors">
												<input
													type="radio"
													name="paymentMethod"
													value="cod"
													checked={formData.paymentMethod === "cod"}
													onChange={handleInputChange}
													className="w-4 h-4"
												/>
												<span>Cash on Delivery (COD)</span>
											</label>
										</div>

										{/* Billing Address Section */}
										<div className="space-y-3">
											<div className="space-y-3">
												<label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
													<input
														type="radio"
														name="billingAddress"
														value="same"
														checked={formData.billingAddress === "same"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span className="ml-3">Same as shipping address</span>
												</label>

												<label className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
													<input
														type="radio"
														name="billingAddress"
														value="different"
														checked={formData.billingAddress === "different"}
														onChange={handleInputChange}
														className="w-4 h-4"
													/>
													<span className="ml-3">Use different address</span>
												</label>
											</div>

											{/* Billing Address Fields */}
											{formData.billingAddress === "different" && (
												<div className="bg-white border border-gray-300 rounded-lg p-6 space-y-6 mt-6">
													<div>
														<input
															type="text"
															name="billingCountry"
															placeholder="Country"
															value={formData.billingCountry}
															onChange={handleInputChange}
															className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>

													<div className="grid grid-cols-2 gap-4">
														<input
															type="text"
															name="billingFirstName"
															placeholder="First Name"
															value={formData.billingFirstName}
															onChange={handleInputChange}
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
														<input
															type="text"
															name="billingLastName"
															placeholder="Last Name"
															value={formData.billingLastName}
															onChange={handleInputChange}
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>

													<div className="grid grid-cols-2 gap-4">
														<input
															type="tel"
															name="billingPhone"
															placeholder="Phone Number"
															value={formData.billingPhone}
															onChange={handleInputChange}
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>

													<div>
														<input
															type="text"
															name="billingAddress1"
															placeholder="Address"
															value={formData.billingAddress1}
															onChange={handleInputChange}
															className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>

													<div>
														<input
															type="text"
															name="billingApartment"
															placeholder="Apartment, Suit (Optional)"
															value={formData.billingApartment}
															onChange={handleInputChange}
															className="w-full bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>

													<div className="grid grid-cols-2 gap-4">
														<input
															type="text"
															name="billingCity"
															placeholder="City"
															value={formData.billingCity}
															onChange={handleInputChange}
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
														<input
															type="text"
															name="billingPostCode"
															placeholder="Post Code"
															value={formData.billingPostCode}
															onChange={handleInputChange}
															className="bg-transparent border-0 border-b border-gray-300 px-0 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-gray-400 text-sm uppercase tracking-wide"
														/>
													</div>
												</div>
											)}
										</div>
									</div>
								</div>
							</div>

							<input
								type="submit"
								value="COMPLETE ORDER"
								className="w-full lg:mt-28 mt-10 cursor-pointer bg-primary-black hover:bg-gray-800 text-white font-semibold h-12 rounded-lg"
							/>
						</form>
					</div>

					{/* Right Section - Order Summary */}
					<div className="order-1 lg:order-2">
						<div className="bg-gray-200 rounded-20 p-6 lg:p-8 sticky top-40">
							{/* Header */}
							<h2 className="font-medium my-8">Order summary (1 item)</h2>

							{/* Product Card */}
							<div className="p-6 mb-8">
								<div className="flex gap-4">
									{/* Product Image */}
									<div className="w-28 h-28 shrink-0">
										<Image src="/images/home/bestsell/1.png" alt="Product" width={96} height={96} className="w-full h-full object-contain" />
									</div>

									{/* Product Details */}
									<div className="flex-1">
										<h5 className="text-2xl font-bold mb-4">Rockerz 425 spatial audio headphone</h5>
										<div className="space-y-2 text-sm text-gray-600">
											<div className="flex justify-between">
												<span>Price</span>
												<span className="font-semibold text-gray-900">TK 2500</span>
											</div>
											<div className="flex justify-between">
												<span>Size</span>
												<span className="font-semibold text-gray-900">38</span>
											</div>
											<div className="flex justify-between">
												<span>Quantity</span>
												<span className="font-semibold text-gray-900">1</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* Coupon Code */}
							<div className="mb-8 pb-8 border-b border-gray-300">
								<div className="flex items-center justify-between gap-3">
									<input
										type="text"
										name="couponCode"
										placeholder="Coupon Code"
										value={formData.couponCode}
										onChange={handleInputChange}
										className="flex-1 bg-transparent border-0 px-0 py-2 text-sm text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-0"
									/>
									<button
										type="button"
										onClick={handleApplyCoupon}
										className="cursor-pointer font-semibold text-gray-600 hover:text-gray-900 whitespace-nowrap"
									>
										Add
									</button>
								</div>
							</div>

							{/* Order Breakdown */}
							<div className="space-y-3 mb-8">
								<div className="flex justify-between text-sm text-gray-600">
									<span>Subtotal</span>
									<span className="font-semibold text-gray-900">TK {subtotal}</span>
								</div>
								<div className="flex justify-between text-sm text-gray-600">
									<span>Shipping</span>
									<span className="font-semibold text-gray-900">TK {shipping}</span>
								</div>
								{couponApplied && (
									<div className="flex justify-between text-sm text-gray-600">
										<span>Discount</span>
										<span className="font-semibold text-gray-900">-TK {discount}</span>
									</div>
								)}
								<div className="flex justify-between text-sm text-gray-600">
									<span>VAT</span>
									<span className="font-semibold text-gray-900">{vat}%</span>
								</div>
							</div>

							{/* Total */}
							<div className="pt-4 border-t border-gray-300 mb-8">
								<div className="flex justify-between items-center">
									<span className="text-base font-semibold">TOTAL</span>
									<span className="text-xl font-bold">TK {total}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}
