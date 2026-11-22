<!DOCTYPE html>
<html>
<head>
    <title>Payment Reminder</title>
</head>
<body>
    <h1>Payment Reminder</h1>
    <p>Dear {{ $recipientType === 'customer' ? $customer->name : $company->name }},</p>
    <p>This is a reminder for a scheduled payment for Invoice #{{ $invoice->id }}.</p>
    <ul>
        <li><strong>Amount Due:</strong> ${{ number_format($schedule->amount, 2) }}</li>
        <li><strong>Due Date:</strong> {{ $schedule->due_date }}</li>
        <li><strong>Invoice Total:</strong> ${{ number_format($invoice->total, 2) }}</li>
        <li><strong>Remaining Due:</strong> ${{ number_format($invoice->due_amount, 2) }}</li>
    </ul>
    <p>Please ensure the payment is made by the due date to avoid any penalties.</p>
    <p>Thank you,</p>
    <p>{{ $company->name }}</p>
</body>
</html>