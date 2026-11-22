<?php

namespace App\Services\Api;

use App\Models\Company;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PathaoCourierService
{
    private const DEFAULT_BASE_URL = 'https://courier-api-sandbox.pathao.com';
    private const DEFAULT_GRANT_TYPE = 'password';

    public function testConnection(Company $company, ?array $overrideConfig = null): array
    {
        $config = $this->resolveConfig($company, $overrideConfig);

        $tokenResponse = $this->issueToken($config);

        return [
            'status' => 1,
            'message' => 'Pathao courier connection verified successfully.',
            'data' => [
                'base_url' => $config['base_url'],
                'grant_type' => $config['grant_type'],
                'access_token' => $tokenResponse['access_token'] ?? null,
                'token_type' => $tokenResponse['token_type'] ?? null,
                'expires_in' => $tokenResponse['expires_in'] ?? null,
                'merchant_identifier' => $tokenResponse['merchant_identifier'] ?? null,
            ],
        ];
    }

    public function issueToken(array $config): array
    {
        $endpoint = rtrim($config['base_url'], '/') . '/aladdin/api/v1/issue-token';
        $payload = [
            'client_id' => $config['client_id'],
            'client_secret' => $config['client_secret'],
            'username' => $config['username'],
            'password' => $config['password'],
            'grant_type' => $config['grant_type'],
        ];

        $response = Http::acceptJson()
            ->asJson()
            ->timeout(20)
            ->retry(1, 300)
            ->post($endpoint, $payload);

        $decoded = $response->json();
        $decoded = is_array($decoded) ? $decoded : [];

        if (! $response->successful()) {
            $message = $this->extractErrorMessage($decoded) ?: "Pathao token request failed with status {$response->status()}.";

            Log::warning('Pathao courier token request failed', [
                'base_url' => $config['base_url'],
                'status' => $response->status(),
                'message' => $message,
            ]);

            throw new RuntimeException($message);
        }

        $token = $this->extractToken($decoded);
        if ($token === null) {
            throw new RuntimeException('Pathao token response did not contain an access token.');
        }

        return [
            'access_token' => $token,
            'token_type' => $decoded['token_type'] ?? data_get($decoded, 'data.token_type'),
            'expires_in' => $decoded['expires_in'] ?? data_get($decoded, 'data.expires_in'),
            'merchant_identifier' => $decoded['merchant_identifier'] ?? data_get($decoded, 'data.merchant_identifier'),
            'raw' => $decoded,
        ];
    }

    public function createOrder(Company $company, array $orderPayload): array
    {
        $config = $this->resolveConfig($company);
        $tokenResponse = $this->issueToken($config);
        $accessToken = (string) $tokenResponse['access_token'];
        $storeId = $this->resolveStoreId($config, $accessToken);
        $endpoint = rtrim($config['base_url'], '/') . '/aladdin/api/v1/orders';

        $payload = [
            'store_id' => $storeId,
            'merchant_order_id' => (string) $orderPayload['merchant_order_id'],
            'recipient_name' => (string) $orderPayload['recipient_name'],
            'recipient_phone' => (string) $orderPayload['recipient_phone'],
            'recipient_address' => (string) $orderPayload['recipient_address'],
            'delivery_type' => (int) ($orderPayload['delivery_type'] ?? 48),
            'item_type' => (int) ($orderPayload['item_type'] ?? 2),
            'special_instruction' => (string) ($orderPayload['special_instruction'] ?? ''),
            'item_quantity' => max(1, (int) ($orderPayload['item_quantity'] ?? 1)),
            'item_weight' => max(0.5, (float) ($orderPayload['item_weight'] ?? 0.5)),
            'item_description' => (string) ($orderPayload['item_description'] ?? 'Merchant parcel'),
            'amount_to_collect' => max(0, (float) ($orderPayload['amount_to_collect'] ?? 0)),
        ];

        $response = Http::acceptJson()
            ->asJson()
            ->withToken($accessToken)
            ->timeout(25)
            ->retry(1, 300)
            ->post($endpoint, $payload);

        $decoded = $response->json();
        $decoded = is_array($decoded) ? $decoded : [];

        if (! $response->successful()) {
            $message = $this->extractErrorMessage($decoded) ?: "Pathao order request failed with status {$response->status()}.";
            Log::warning('Pathao courier order request failed', [
                'merchant_order_id' => $payload['merchant_order_id'],
                'status' => $response->status(),
                'message' => $message,
            ]);
            throw new RuntimeException($message);
        }

        $data = data_get($decoded, 'data');
        $data = is_array($data) ? $data : $decoded;

        return [
            'status' => 'submitted',
            'store_id' => $storeId,
            'consignment_id' => $data['consignment_id'] ?? $data['consignmentId'] ?? null,
            'merchant_order_id' => $data['merchant_order_id'] ?? $payload['merchant_order_id'],
            'delivery_fee' => $data['delivery_fee'] ?? null,
            'raw' => $decoded,
        ];
    }

    public function getOrderInfo(Company $company, string $consignmentId): array
    {
        $config = $this->resolveConfig($company);
        $accessToken = (string) $this->issueToken($config)['access_token'];
        $endpoint = rtrim($config['base_url'], '/') . '/aladdin/api/v1/orders/' . urlencode($consignmentId) . '/info';
        $response = Http::acceptJson()->withToken($accessToken)->timeout(20)->get($endpoint);
        $decoded = $response->json();
        $decoded = is_array($decoded) ? $decoded : [];

        if (! $response->successful()) {
            throw new RuntimeException(
                $this->extractErrorMessage($decoded) ?: "Pathao order status request failed with status {$response->status()}."
            );
        }

        $data = data_get($decoded, 'data');
        $data = is_array($data) ? $data : $decoded;

        return [
            'order_status' => (string) ($data['order_status'] ?? $data['status'] ?? ''),
            'delivery_fee' => $data['delivery_fee'] ?? null,
            'raw' => $decoded,
        ];
    }

    private function resolveStoreId(array $config, string $accessToken): int
    {
        $configuredStoreId = (int) ($config['store_id'] ?? 0);
        if ($configuredStoreId > 0) {
            return $configuredStoreId;
        }

        $endpoint = rtrim($config['base_url'], '/') . '/aladdin/api/v1/stores';
        $response = Http::acceptJson()->withToken($accessToken)->timeout(20)->get($endpoint);
        $decoded = $response->json();
        $decoded = is_array($decoded) ? $decoded : [];

        if (! $response->successful()) {
            throw new RuntimeException($this->extractErrorMessage($decoded) ?: 'Pathao stores could not be loaded.');
        }

        $stores = data_get($decoded, 'data.data', data_get($decoded, 'data', []));
        $stores = is_array($stores) ? $stores : [];
        $firstStore = collect($stores)->first(fn ($store) => (int) ($store['store_id'] ?? $store['id'] ?? 0) > 0);
        $storeId = (int) ($firstStore['store_id'] ?? $firstStore['id'] ?? 0);

        if ($storeId <= 0) {
            throw new RuntimeException('No Pathao merchant store was found. Create a store in the Pathao merchant panel first.');
        }

        return $storeId;
    }

    private function resolveConfig(Company $company, ?array $overrideConfig = null): array
    {
        $storedSettings = is_array($company->courier_settings ?? null) ? $company->courier_settings : [];
        $pathaoSettings = is_array($storedSettings['pathao'] ?? null) ? $storedSettings['pathao'] : [];
        $overrides = is_array($overrideConfig) ? $overrideConfig : [];

        $config = array_merge($pathaoSettings, $overrides);

        return [
            'base_url' => rtrim(trim((string) ($config['base_url'] ?? self::DEFAULT_BASE_URL)), '/') ?: self::DEFAULT_BASE_URL,
            'client_id' => trim((string) ($config['client_id'] ?? '')),
            'client_secret' => trim((string) ($config['client_secret'] ?? '')),
            'username' => trim((string) ($config['username'] ?? '')),
            'password' => (string) ($config['password'] ?? ''),
            'grant_type' => trim((string) ($config['grant_type'] ?? self::DEFAULT_GRANT_TYPE)) ?: self::DEFAULT_GRANT_TYPE,
            'store_id' => (int) ($config['store_id'] ?? $config['merchant_store_id'] ?? 0),
        ];
    }

    private function extractToken(array $payload): ?string
    {
        $candidates = [
            $payload['access_token'] ?? null,
            data_get($payload, 'data.access_token'),
            $payload['token'] ?? null,
            data_get($payload, 'data.token'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractErrorMessage(array $payload): ?string
    {
        $candidates = [
            $payload['message'] ?? null,
            $payload['error_description'] ?? null,
            $payload['error'] ?? null,
            data_get($payload, 'data.message'),
            data_get($payload, 'data.error'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }
}
