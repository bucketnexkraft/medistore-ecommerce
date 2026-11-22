<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice {{ $data['invoiceNumber'] }}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .invoice-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #eee;
        }
        .invoice-details {
            flex: 1;
        }
        .company-info {
            text-align: right;
            flex: 1;
        }
        .logo {
            max-height: 60px;
            margin-bottom: 8px;
            font-weight: bold;
            color: #333;
            font-size: 18px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            color: #333;
            margin: 5px 0;
        }
        .company-contact {
            font-size: 12px;
            color: #666;
            margin: 2px 0;
        }
        .invoice-title {
            font-size: 20px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
        }
        .invoice-info {
            font-size: 12px;
            margin: 5px 0;
        }
        .bill-to {
            margin-bottom: 20px;
        }
        .bill-to-title {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 5px;
        }
        .bill-to-info {
            font-size: 12px;
            color: #666;
            margin: 2px 0;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 11px;
        }
        .items-table th {
            background-color: #f8f9fa;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 10px;
            text-transform: uppercase;
            border-bottom: 1px solid #dee2e6;
        }
        .items-table td {
            padding: 8px;
            border-bottom: 1px solid #eee;
            vertical-align: top;
        }
        .items-table .text-right {
            text-align: right;
        }
        .item-details {
            font-size: 11px;
        }
        .item-color {
            color: #666;
            font-size: 10px;
        }
        .item-barcode {
            color: #999;
            font-size: 9px;
        }
        .payment-section {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
        }
        .payment-info {
            flex: 1;
        }
        .payment-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: bold;
            margin: 5px 0;
        }
        .payment-method {
            background-color: #e3f2fd;
            color: #1976d2;
        }
        .payment-status-paid {
            background-color: #e8f5e8;
            color: #2e7d32;
        }
        .payment-status-unpaid {
            background-color: #ffebee;
            color: #c62828;
        }
        .payment-status-partial {
            background-color: #fff3e0;
            color: #f57c00;
        }
        .totals-section {
            width: 300px;
            text-align: right;
            margin-left: auto;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 12px;
        }
        .total-row.grand-total {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #333;
            padding-top: 5px;
            margin-top: 10px;
        }
        .barcode-section {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 4px;
        }
        .barcode {
            font-family: 'Courier New', monospace;
            font-size: 14px;
            font-weight: bold;
            margin: 10px 0;
        }
        .barcode-img {
            margin: 10px auto;
            display: block;
        }
        .item-variant {
            color: #666;
            font-size: 10px;
            font-style: italic;
            margin-top: 2px;
        }
        .download-section {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
        }
        .download-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 11px;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="header">
            <div class="invoice-details">
                <h1 class="invoice-title">{{ $data['invoice']->type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice' }}</h1>
                <div class="invoice-info">
                    <p><strong>Invoice Number:</strong> {{ $data['invoiceNumber'] }}</p>
                    <p><strong>Date:</strong> {{ $data['invoiceDate'] }}</p>
                </div>
                
                <div class="bill-to">
                    <p class="bill-to-title">{{ $data['invoice']->type === 'sale' ? 'Bill to' : 'Received from' }}:</p>
                    <p class="bill-to-info"><strong>{{ $data['customerName'] }}</strong></p>
                    @if($data['invoice']->customer && $data['invoice']->customer->email)
                        <p class="bill-to-info">{{ $data['invoice']->customer->email }}</p>
                    @elseif($data['invoice']->supplier && $data['invoice']->supplier->email)
                        <p class="bill-to-info">{{ $data['invoice']->supplier->email }}</p>
                    @endif
                    @if($data['invoice']->customer && $data['invoice']->customer->phone)
                        <p class="bill-to-info">{{ $data['invoice']->customer->phone }}</p>
                    @elseif($data['invoice']->supplier && $data['invoice']->supplier->phone)
                        <p class="bill-to-info">{{ $data['invoice']->supplier->phone }}</p>
                    @endif
                    @if($data['invoice']->customer && $data['invoice']->customer->address)
                        <p class="bill-to-info">{{ $data['invoice']->customer->address }}</p>
                    @elseif($data['invoice']->supplier && $data['invoice']->supplier->address)
                        <p class="bill-to-info">{{ $data['invoice']->supplier->address }}</p>
                    @endif
                </div>
            </div>
            
            <div class="company-info">
                @if($data['companyInfo']['logo'])
                    <img src="{{ $data['companyInfo']['logo'] }}" alt="Company Logo" class="logo">
                @else
                    <div class="logo">{{ $data['companyInfo']['name'] }}</div>
                @endif
                <p class="company-name">{{ $data['companyInfo']['name'] }}</p>
                <p class="company-contact">{{ $data['companyInfo']['email'] }}</p>
                @if($data['companyInfo']['phone'])
                    <p class="company-contact">{{ $data['companyInfo']['phone'] }}</p>
                @endif
                @if($data['companyInfo']['address'])
                    <p class="company-contact">{{ $data['companyInfo']['address'] }}</p>
                @endif
            </div>
        </div>

        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>ITEM</th>
                    <th class="text-right">QTY</th>
                    <th class="text-right">PRICE</th>
                    <th class="text-right">DISCOUNT</th>
                    <th class="text-right">VAT (TVA)</th>
                    <th class="text-right">AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                @if($data['invoice']->items && count($data['invoice']->items) > 0)
                    @foreach($data['invoice']->items as $item)
                        <tr>
                            <td>
                                <div class="item-details">
                                    {{ $item->product->name ?? 'N/A' }}
                                    @if($item->variant_id)
                                        <div class="item-variant">
                                            @if($item->variant_id)
                                                @foreach($item->variant_id as $key => $value)
                                                    {{ ucfirst($key) }}: {{ $value }}<br>
                                                @endforeach
                                            @endif
                                        </div>
                                    @endif
                                    @if($item->product->code)
                                        <div class="item-barcode">{{ $item->product->code }}</div>
                                        
                                    @endif
                                </div>
                            </td>
                            <td class="text-right">{{ $item->qty ?? 0 }}</td>
                            <td class="text-right">{{ number_format($item->unit_price ?? 0, 2) }}</td>
                            <td class="text-right">{{ number_format($item->discount ?? 0, 2) }}</td>
                            <td class="text-right">{{ number_format($item->vat ?? 0, 2) }}</td>
                            <td class="text-right">{{ number_format($item->total ?? 0, 2) }}</td>
                        </tr>
                    @endforeach
                @else
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px;">No items found</td>
                    </tr>
                @endif
            </tbody>
        </table>

        <!-- Payment and Totals Section -->
        <div class="payment-section">
            <div class="payment-info">
                @if($data['invoice']->payment_method)
                    <div class="payment-badge payment-method">
                        Payment Method: {{ $data['invoice']->payment_method }}
                    </div>
                @endif
                <div class="payment-badge payment-status-{{ $data['paymentStatus'] == 'Paid' ? 'paid' : ($data['paymentStatus'] == 'Unpaid' ? 'unpaid' : 'partial') }}">
                    Payment Status: {{ $data['paymentStatus'] }}
                </div>
            </div>
            
            <div class="totals-section">
                <div class="total-row">
                    <span>Subtotal (HT Total):</span>
                    <span>{{ number_format($data['invoice']->total - ($data['invoice']->tax ?? 0), 2) }}</span>
                </div>
                @if($data['invoice']->tax > 0)
                    <div class="total-row">
                        <span>TTC:</span>
                        <span>{{ number_format($data['invoice']->total, 2) }}</span>
                    </div>
                @endif
                <div class="total-row grand-total">
                    <span>Total:</span>
                    <span>{{ $data['totalAmount'] }}</span>
                </div>
                <div class="total-row">
                    <span>Paid Amount:</span>
                    <span>{{ number_format($data['invoice']->paid_amount ?? 0, 2) }}</span>
                </div>
            </div>
        </div>

        <!-- Barcode Section -->
        <div class="barcode-section">
            <div class="" style="display:flex; justify-content: center;">
                <div style="text-align: center; margin: 10px 0;">
                    {!! $data['barcodeHtml'] !!}
                    <div class="barcode">{{ $data['invoiceNumber'] }}</div>
                </div>
            </div>
        </div>

        <!-- Download Section -->
        <div class="download-section">
            <h3>Download Your Invoice</h3>
            <p>You can download a printable copy of your invoice using the button below:</p>
            <a href="{{ $data['downloadLink'] }}" class="download-button" target="_blank">
                Download Invoice PDF
            </a>
            <p><small>This link will be valid for 30 days. If you need assistance, please contact us at {{ $data['companyInfo']['email'] }}</small></p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>&copy; {{ date('Y') }} {{ $data['companyInfo']['name'] }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
