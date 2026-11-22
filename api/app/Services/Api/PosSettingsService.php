<?php

namespace App\Services\Api;

use App\Models\PosSetting;

class PosSettingsService
{
    private function defaultPaymentMethods(): array
    {
        return [
            ['name' => 'Cash', 'config' => [], 'enabled' => true],
            ['name' => 'Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => false], 'enabled' => true],
            ['name' => 'QR Payment', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
            ['name' => 'Reward Points', 'config' => [], 'enabled' => false],
            ['name' => 'Cash Refund', 'config' => [], 'enabled' => false],
            ['name' => 'Refund to Card', 'config' => ['last_digit_length' => [5, 6], 'require_last_digits' => true], 'enabled' => false],
            ['name' => 'Refund to MF', 'config' => ['providers' => ['bKash', 'Nagad', 'Rocket', 'Upay']], 'enabled' => false],
        ];
    }

    private function normalizePaymentMethods(mixed $value): array
    {
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
        }

        if (!is_array($value)) {
            return $this->defaultPaymentMethods();
        }

        $methods = array_values(array_filter($value, fn ($item) => is_array($item) && !empty($item['name'])));

        if ($methods === []) {
            return $this->defaultPaymentMethods();
        }

        return array_map(function (array $method) {
            return [
                'name' => (string) ($method['name'] ?? ''),
                'enabled' => (bool) ($method['enabled'] ?? false),
                'config' => is_array($method['config'] ?? null) ? $method['config'] : [],
            ];
        }, $methods);
    }

    public function getSettingsResponse(): array
    {
        $settings = PosSetting::where('key', 'payment_methods')->first();
        $returnPolicy = PosSetting::where('key', 'return_policy')->first();

        $defaultReturnPolicy = [
            'enabled' => true,
            'return_window_days' => 7,
            'allow_partial_return' => true,
            'require_invoice' => true,
            'allow_damaged_return' => true,
            'manager_approval_threshold' => 0,
            'allowed_return_modes' => ['refund', 'exchange'],
        ];

        return [
            'status' => 1,
            'success' => true,
            'data' => $this->normalizePaymentMethods($settings?->value),
            'return_policy' => array_merge($defaultReturnPolicy, is_array($returnPolicy?->value) ? $returnPolicy->value : []),
        ];
    }

    public function updateSettingsResponse(array $paymentMethods, ?array $returnPolicy = null): array
    {
        $normalizedPaymentMethods = $this->normalizePaymentMethods($paymentMethods);

        $paymentSettings = PosSetting::updateOrCreate(
            ['key' => 'payment_methods'],
            ['value' => $normalizedPaymentMethods]
        );
        $defaultReturnPolicy = [
            'enabled' => true,
            'return_window_days' => 7,
            'allow_partial_return' => true,
            'require_invoice' => true,
            'allow_damaged_return' => true,
            'manager_approval_threshold' => 0,
            'allowed_return_modes' => ['refund', 'exchange'],
        ];
        $resolvedReturnPolicy = array_merge($defaultReturnPolicy, is_array($returnPolicy) ? $returnPolicy : []);
        $returnSettings = PosSetting::updateOrCreate(
            ['key' => 'return_policy'],
            ['value' => $resolvedReturnPolicy]
        );

        return [
            'status' => 1,
            'success' => true,
            'message' => 'Settings updated successfully',
            'data' => $this->normalizePaymentMethods($paymentSettings->value),
            'return_policy' => $returnSettings->value,
        ];
    }
}
