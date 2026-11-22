<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $invoice->type === 'quotation' ? 'Quotation' : 'Invoice' }} {{ $invoice->invoice_no }}</title>
    <style>
        @page {
            margin: 15mm;
            size: A4;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }
        .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
        }
        .invoice-details {
            flex: 1;
        }
        .company-info {
            text-align: right;
            flex: 1;
        }
        .invoice-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #333;
        }
        .invoice-info p {
            margin: 3px 0;
            font-size: 10px;
        }
        .bill-to {
            margin-top: 15px;
        }
        .bill-to-title {
            font-weight: bold;
            margin-bottom: 5px;
            font-size: 11px;
        }
        .bill-to-info {
            margin: 2px 0;
            font-size: 10px;
        }
        .logo {
            max-width: 120px;
            height: auto;
            margin-bottom: 8px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .company-contact {
            margin: 2px 0;
            font-size: 10px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 10px;
        }
        .items-table th {
            background-color: #f8f9fa;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            border-bottom: 1px solid #dee2e6;
            font-size: 9px;
            text-transform: uppercase;
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
            font-size: 10px;
        }
        .item-variant {
            color: #666;
            font-size: 8px;
            font-style: italic;
            margin-top: 2px;
        }
        .item-color {
            color: #666;
            font-size: 8px;
        }
        .item-barcode {
            color: #999;
            font-size: 8px;
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
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: bold;
            margin: 3px 0;
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
            width: 250px;
            text-align: right;
            margin-left: auto;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin: 3px 0;
            font-size: 10px;
        }
        .total-row.grand-total {
            font-weight: bold;
            font-size: 12px;
            border-top: 1px solid #333;
            padding-top: 5px;
            margin-top: 8px;
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
            font-size: 12px;
            font-weight: bold;
            margin: 8px 0;
        }
        .footer {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 9px;
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <!-- Header Section -->
        <div class="header">
            <div class="invoice-details">
                <h1 class="invoice-title">
                    @if($invoice->type === 'quotation')
                        Quotation
                    @elseif($invoice->type === 'sale')
                        Sales Invoice
                    @else
                        Purchase Invoice
                    @endif
                </h1>
                <div class="invoice-info">
                    <p><strong>{{ $invoice->type === 'quotation' ? 'Quotation Number' : 'Invoice Number' }}:</strong> {{ $invoice->invoice_no }}</p>
                    <p><strong>Date:</strong> {{ \Carbon\Carbon::parse($invoice->date)->format('M d, Y') }}</p>
                </div>
                
                <div class="bill-to">
                    <p class="bill-to-title">
                        {{ in_array($invoice->type, ['sale', 'quotation']) ? 'Bill to' : 'Received from' }}:
                    </p>
                    <p class="bill-to-info"><strong>{{ $customerName }}</strong></p>
                    @if($invoice->customer && $invoice->customer->email)
                        <p class="bill-to-info">{{ $invoice->customer->email }}</p>
                    @elseif($invoice->supplier && $invoice->supplier->email)
                        <p class="bill-to-info">{{ $invoice->supplier->email }}</p>
                    @endif
                    @if($invoice->customer && $invoice->customer->phone)
                        <p class="bill-to-info">{{ $invoice->customer->phone }}</p>
                    @elseif($invoice->supplier && $invoice->supplier->phone)
                        <p class="bill-to-info">{{ $invoice->supplier->phone }}</p>
                    @endif
                    @if($invoice->customer && $invoice->customer->address)
                        <p class="bill-to-info">{{ $invoice->customer->address }}</p>
                    @elseif($invoice->supplier && $invoice->supplier->address)
                        <p class="bill-to-info">{{ $invoice->supplier->address }}</p>
                    @endif
                </div>
            </div>
            
            <div class="company-info">
                @if($companyInfo['logo'])
                    <img src="{{ $companyInfo['logo'] }}" alt="Company Logo" class="logo">
                @else
                    <div class="logo">{{ $companyInfo['name'] }}</div>
                @endif
                <p class="company-name">{{ $companyInfo['name'] }}</p>
                <p class="company-contact">{{ $companyInfo['email'] }}</p>
                @if($companyInfo['phone'])
                    <p class="company-contact">{{ $companyInfo['phone'] }}</p>
                @endif
                @if($companyInfo['address'])
                    <p class="company-contact">{{ $companyInfo['address'] }}</p>
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
                @if($invoice->items && count($invoice->items) > 0)
                    @foreach($invoice->items as $item)
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
                @if($invoice->payment_method)
                    <div class="payment-badge payment-method">
                        Payment Method: {{ $invoice->payment_method }}
                    </div>
                @endif
                <div class="payment-badge payment-status-{{ $invoice->payment_status == 1 ? 'paid' : ($invoice->payment_status == 0 ? 'unpaid' : 'partial') }}">
                    Payment Status: {{ $invoice->payment_status == 1 ? 'Paid' : ($invoice->payment_status == 0 ? 'Unpaid' : 'Partially Paid') }}
                </div>
            </div>
            
            <div class="totals-section">
                <div class="total-row">
                    <span>Subtotal (HT Total):</span>
                    <span>{{ number_format($invoice->total - ($invoice->tax ?? 0), 2) }}</span>
                </div>
                @if($invoice->tax > 0)
                    <div class="total-row">
                        <span>TTC:</span>
                        <span>{{ number_format($invoice->total, 2) }}</span>
                    </div>
                @endif
                <div class="total-row grand-total">
                    <span>Total:</span>
                    <span>{{ number_format($invoice->total, 2) }}</span>
                </div>
                <div class="total-row">
                    <span>Paid Amount:</span>
                    <span>{{ number_format($invoice->paid_amount ?? 0, 2) }}</span>
                </div>
            </div>
        </div>

        <!-- Barcode Section -->
        <div class="barcode-section">
            <div class="" style="display:flex; justify-content: center;">
                {!! $barcodeHtml !!} 
                <div class="barcode">{{ $invoice->invoice_no }}</div>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your business!</p>
            <p>&copy; {{ date('Y') }} {{ $companyInfo['name'] }}. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
