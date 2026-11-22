<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Invoice {{ $order->order_no }}</title>
    <style>
        @page {
            margin: 16mm;
            size: A4;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            color: #111827;
            line-height: 1.45;
        }

        .container {
            width: 100%;
        }

        .header-table,
        .info-table,
        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }

        .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 14px;
            margin-bottom: 18px;
        }

        .invoice-title {
            margin: 0 0 6px;
            font-size: 28px;
            font-weight: bold;
            color: #111827;
        }

        .subtle {
            color: #6b7280;
        }

        .company-block {
            text-align: right;
            vertical-align: top;
        }

        .company-name {
            margin: 0 0 6px;
            font-size: 18px;
            font-weight: bold;
        }

        .section {
            margin-top: 18px;
        }

        .section-title {
            margin: 0 0 8px;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            color: #6b7280;
        }

        .panel {
            border: 1px solid #d1d5db;
            padding: 12px 14px;
            vertical-align: top;
        }

        .panel p,
        .company-block p,
        .meta-list p {
            margin: 0 0 5px;
        }

        .meta-list strong {
            display: inline-block;
            min-width: 98px;
        }

        .items-table {
            margin-top: 18px;
            border: 1px solid #d1d5db;
        }

        .items-table th {
            background: #f3f4f6;
            border-bottom: 1px solid #d1d5db;
            padding: 10px 8px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
        }

        .items-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px 8px;
            vertical-align: top;
        }

        .items-table tbody tr:last-child td {
            border-bottom: none;
        }

        .text-right {
            text-align: right;
        }

        .product-name {
            margin: 0 0 3px;
            font-size: 13px;
            font-weight: bold;
        }

        .totals-wrap {
            width: 320px;
            margin-left: auto;
            margin-top: 18px;
        }

        .totals-table td {
            padding: 6px 0;
            font-size: 12px;
        }

        .totals-table .total-row td {
            border-top: 2px solid #111827;
            padding-top: 10px;
            font-size: 15px;
            font-weight: bold;
        }

        .footer {
            margin-top: 26px;
            padding-top: 12px;
            border-top: 1px solid #d1d5db;
            text-align: center;
            color: #6b7280;
            font-size: 10px;
        }
    </style>
</head>
<body>
    @php
        $shippingLocation = collect([
            $shippingAddress?->upazila_name,
            $shippingAddress?->district_name,
            $shippingAddress?->division_name,
            $shippingAddress?->country,
            $shippingAddress?->postal_code,
        ])->filter()->implode(', ');

        $companyLocation = collect([
            $seller?->address,
            $seller?->city,
            $seller?->state,
            $seller?->post_code,
            $seller?->country,
        ])->filter()->implode(', ');

        $groupDiscount = (float) ($order->group_discount_amount ?? 0);
        $couponDiscount = (float) ($order->coupon_discount_amount ?? 0);
        $subtotalBeforeDiscount = (float) $order->subtotal + $groupDiscount;
    @endphp

    <div class="container">
        <table class="header-table header">
            <tr>
                <td style="width: 52%; vertical-align: top;">
                    <h1 class="invoice-title">Invoice</h1>
                    <p class="subtle">Order {{ $order->order_no }}</p>
                </td>
                <td class="company-block">
                    <p class="company-name">{{ $companyInfo['name'] }}</p>
                    @if(!empty($companyInfo['email']))
                        <p>{{ $companyInfo['email'] }}</p>
                    @endif
                    @if(!empty($companyInfo['phone']))
                        <p>{{ $companyInfo['phone'] }}</p>
                    @endif
                    @if(!empty($companyInfo['address']))
                        <p>{{ $companyInfo['address'] }}</p>
                    @endif
                </td>
            </tr>
        </table>

        <table class="info-table">
            <tr>
                <td style="width: 48%; padding-right: 8px; vertical-align: top;">
                    <div class="panel">
                        <p class="section-title">Shipping Information</p>
                        <p><strong>{{ $shippingAddress?->full_name ?: 'N/A' }}</strong></p>
                        <p>{{ $shippingAddress?->address ?: 'No address available' }}</p>
                        @if($shippingLocation !== '')
                            <p>{{ $shippingLocation }}</p>
                        @endif
                        @if($shippingAddress?->phone)
                            <p>{{ $shippingAddress->phone }}</p>
                        @endif
                        @if($shippingAddress?->email)
                            <p>{{ $shippingAddress->email }}</p>
                        @endif
                    </div>
                </td>
                <td style="width: 52%; padding-left: 8px; vertical-align: top;">
                    <div class="panel">
                        <p class="section-title">Order Information</p>
                        <div class="meta-list">
                            <p><strong>Order ID:</strong> {{ $order->order_no }}</p>
                            <p><strong>Placed On:</strong> {{ optional($order->placed_at ?? $order->created_at)->format('M d, Y h:i A') }}</p>
                            <p><strong>Payment:</strong> {{ strtoupper((string) $order->payment_method) }}</p>
                            <p><strong>Payment Status:</strong> {{ ucfirst((string) $order->payment_status) }}</p>
                            <p><strong>Order Status:</strong> {{ ucfirst((string) $order->order_status) }}</p>
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <div class="section">
            <p class="section-title">Seller Information</p>
            <div class="panel">
                <p><strong>{{ $seller?->name ?: 'Seller support' }}</strong></p>
                @if($seller?->contact_name)
                    <p>{{ $seller->contact_name }}</p>
                @endif
                @if($companyLocation !== '')
                    <p>{{ $companyLocation }}</p>
                @endif
                @if($seller?->phone_number)
                    <p>{{ $seller->phone_number }}</p>
                @endif
                @if($seller?->email)
                    <p>{{ $seller->email }}</p>
                @endif
            </div>
        </div>

        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="text-right">Qty</th>
                    <th class="text-right">Unit Price</th>
                    <th class="text-right">Tax</th>
                    <th class="text-right">Line Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($order->items as $item)
                    <tr>
                        <td>
                            <p class="product-name">{{ $item->product_name }}</p>
                            @if($item->brand_name || $item->category_name)
                                <p class="subtle">{{ collect([$item->brand_name, $item->category_name])->filter()->implode(' | ') }}</p>
                            @endif
                        </td>
                        <td class="text-right">{{ rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') }}</td>
                        <td class="text-right">{{ number_format((float) $item->unit_price, 2) }}</td>
                        <td class="text-right">{{ number_format((float) $item->tax_amount, 2) }}</td>
                        <td class="text-right">{{ number_format((float) $item->line_total, 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <div class="totals-wrap">
            <table class="totals-table">
                <tr>
                    <td>Subtotal</td>
                    <td class="text-right">{{ number_format($subtotalBeforeDiscount, 2) }}</td>
                </tr>
                @if($groupDiscount > 0)
                    <tr>
                        <td>Discount</td>
                        <td class="text-right">-{{ number_format($groupDiscount, 2) }}</td>
                    </tr>
                @endif
                @if($couponDiscount > 0 || filled($order->coupon_code))
                    <tr>
                        <td>Coupon{{ $order->coupon_code ? ' (' . $order->coupon_code . ')' : '' }}</td>
                        <td class="text-right">-{{ number_format($couponDiscount, 2) }}</td>
                    </tr>
                @endif
                <tr>
                    <td>Tax</td>
                    <td class="text-right">{{ number_format((float) $order->tax_amount, 2) }}</td>
                </tr>
                <tr>
                    <td>Delivery Charge</td>
                    <td class="text-right">{{ number_format((float) $order->shipping_amount, 2) }}</td>
                </tr>
                <tr class="total-row">
                    <td>Total</td>
                    <td class="text-right">{{ number_format((float) $order->total_amount, 2) }}</td>
                </tr>
            </table>
        </div>

        <div class="footer">
            <p>Thank you for your order.</p>
            <p>This invoice was generated for order {{ $order->order_no }}.</p>
        </div>
    </div>
</body>
</html>
