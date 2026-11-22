<?php

namespace App\Services;

use App\Models\Company;
use App\Models\CustomerOrder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class CompanySmsService
{
    private const PROVIDER_BULK_SMS_BD = 'bulk_sms_bd';

    private const DEFAULT_TEMPLATES = [
        'order_confirmation' => 'Hello {{customer_name}}, your order #{{order_id}} has been confirmed. Total: {{order_total}}. - {{shop_name}}',
        'order_shipped' => 'Hello {{customer_name}}, your order #{{order_id}} is on the way. Tracking: {{tracking_number}}. - {{shop_name}}',
        'order_delivered' => 'Hello {{customer_name}}, your order #{{order_id}} has been delivered successfully. Thank you for shopping with {{shop_name}}.',
        'otp_verification' => 'Your {{shop_name}} verification code is {{otp_code}}. This code will expire in {{otp_expiry_minutes}} minutes.',
    ];

    public function sendOrderConfirmation(CustomerOrder $order): bool
    {
        return $this->sendOrderTemplate($order, 'order_confirmation');
    }

    public function sendOrderShipped(CustomerOrder $order): bool
    {
        return $this->sendOrderTemplate($order, 'order_shipped');
    }

    public function sendOrderDelivered(CustomerOrder $order): bool
    {
        return $this->sendOrderTemplate($order, 'order_delivered');
    }

    public function sendOtpVerification(?Company $company, ?string $phone, string $otpCode, int $expiryMinutes): bool
    {
        if (! $company) {
            return false;
        }

        $template = $this->resolveTemplate($company, 'otp_verification');
        $message = $this->renderTemplate($template, [
            'shop_name' => $this->resolveShopName($company),
            'otp_code' => trim($otpCode),
            'otp_expiry_minutes' => (string) $expiryMinutes,
        ]);

        return $this->sendMessage($company, $phone, $message, [
            'event' => 'otp_verification',
            'company_id' => (string) $company->getKey(),
        ]);
    }

    public function sendOrderTemplate(CustomerOrder $order, string $templateKey): bool
    {
        $order->loadMissing(['company', 'shippingAddress', 'user']);

        $company = $order->company;
        if (! $company) {
            return false;
        }

        $template = $this->resolveTemplate($company, $templateKey);
        $message = $this->renderTemplate($template, [
            'customer_name' => $this->resolveCustomerName($order),
            'order_id' => (string) $order->order_no,
            'order_total' => number_format((float) $order->total_amount, 2, '.', ''),
            'tracking_number' => $this->resolveTrackingNumber($order),
            'shop_name' => $this->resolveShopName($company),
            'otp_code' => '',
            'otp_expiry_minutes' => '',
        ]);

        return $this->sendMessage($company, $this->resolveOrderPhone($order), $message, [
            'event' => $templateKey,
            'company_id' => (string) $company->getKey(),
            'order_id' => (string) $order->id,
            'order_no' => (string) $order->order_no,
        ]);
    }

    public function sendMessage(Company $company, ?string $phone, string $message, array $context = []): bool
    {
        $provider = strtolower(trim((string) ($company->sms_service_provider ?? '')));
        $apiKey = trim((string) ($company->sms_api_key ?? ''));
        $senderId = trim((string) ($company->sms_sender_id ?? ''));
        $normalizedPhone = $this->normalizePhoneNumber($phone);
        $compiledMessage = trim($message);

        if ($provider === '' || $apiKey === '' || $senderId === '' || $normalizedPhone === null || $compiledMessage === '') {
            return false;
        }

        try {
            return match ($provider) {
                self::PROVIDER_BULK_SMS_BD => $this->sendViaBulkSmsBd($apiKey, $senderId, $normalizedPhone, $compiledMessage, $context),
                default => false,
            };
        } catch (Throwable $exception) {
            Log::warning('SMS sending failed.', [
                ...$context,
                'provider' => $provider,
                'phone' => $normalizedPhone,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function sendViaBulkSmsBd(string $apiKey, string $senderId, string $phone, string $message, array $context = []): bool
    {
        $messageType = $this->detectMessageType($message);

        $response = Http::asForm()
            ->timeout(15)
            ->post('http://bulksmsbd.net/api/smsapi', [
                'api_key' => $apiKey,
                'type' => $messageType,
                'number' => $phone,
                'senderid' => $senderId,
                'message' => $message,
            ]);

        $body = trim((string) $response->body());
        $decoded = json_decode($body, true);
        $statusCode = is_array($decoded)
            ? (string) ($decoded['code'] ?? $decoded['status'] ?? $decoded['response_code'] ?? '')
            : $body;

        $successful = $response->successful() && in_array($statusCode, ['202', '200', 'success'], true);

        if (! $successful) {
            Log::warning('Bulk SMS BD returned a non-success response.', [
                ...$context,
                'http_status' => $response->status(),
                'response' => $body,
            ]);
        }

        return $successful;
    }

    private function resolveTemplate(Company $company, string $templateKey): string
    {
        $configuredTemplate = data_get($company->sms_template_settings, "{$templateKey}.template");
        $template = is_string($configuredTemplate) ? trim($configuredTemplate) : '';

        if ($template !== '') {
            return $template;
        }

        return self::DEFAULT_TEMPLATES[$templateKey] ?? '';
    }

    private function renderTemplate(string $template, array $variables): string
    {
        $rendered = $template;

        foreach ($variables as $key => $value) {
            $rendered = str_replace('{{' . $key . '}}', (string) $value, $rendered);
        }

        return preg_replace('/\{\{\s*[a-zA-Z0-9_]+\s*\}\}/', '', $rendered) ?? $rendered;
    }

    private function resolveShopName(Company $company): string
    {
        return trim((string) ($company->name ?: 'Shop'));
    }

    private function resolveCustomerName(CustomerOrder $order): string
    {
        $shippingName = trim((string) ($order->shippingAddress?->full_name ?? ''));
        if ($shippingName !== '') {
            return $shippingName;
        }

        $userName = trim(implode(' ', array_filter([
            (string) ($order->user?->first_name ?? ''),
            (string) ($order->user?->last_name ?? ''),
        ])));

        if ($userName !== '') {
            return $userName;
        }

        return 'Customer';
    }

    private function resolveOrderPhone(CustomerOrder $order): ?string
    {
        $shippingPhone = trim((string) ($order->shippingAddress?->phone ?? ''));
        if ($shippingPhone !== '') {
            return $shippingPhone;
        }

        $userPhone = trim((string) ($order->user?->phone ?? ''));
        return $userPhone !== '' ? $userPhone : null;
    }

    private function resolveTrackingNumber(CustomerOrder $order): string
    {
        $remarks = trim((string) ($order->remarks ?? ''));
        if ($remarks !== '') {
            return $remarks;
        }

        $gatewayTxn = trim((string) ($order->gateway_txn_id ?? ''));
        if ($gatewayTxn !== '') {
            return $gatewayTxn;
        }

        $trx = trim((string) ($order->trx ?? ''));
        if ($trx !== '') {
            return $trx;
        }

        return (string) $order->order_no;
    }

    private function normalizePhoneNumber(?string $phone): ?string
    {
        $raw = trim((string) $phone);
        if ($raw === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $raw);
        if (! is_string($digits) || $digits === '') {
            return null;
        }

        if (str_starts_with($digits, '8801') && strlen($digits) === 13) {
            return $digits;
        }

        if (str_starts_with($digits, '01') && strlen($digits) === 11) {
            return '88' . $digits;
        }

        if (str_starts_with($digits, '1') && strlen($digits) === 10) {
            return '880' . $digits;
        }

        return $digits;
    }

    private function detectMessageType(string $message): string
    {
        return preg_match('/[^\x00-\x7F]/', $message) === 1 ? 'unicode' : 'text';
    }
}
