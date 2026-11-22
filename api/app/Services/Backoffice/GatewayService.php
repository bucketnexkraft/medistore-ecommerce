<?php

namespace App\Services\Backoffice;

use App\Models\Gateway;
use App\Services\ImageService;
use Illuminate\Http\UploadedFile;

class GatewayService
{
    public function update(Gateway $gateway, array $data): bool
    {
        if (isset($data['image']) && $data['image'] instanceof UploadedFile) {
            $data['image'] = ImageService::upload($data['image'], 'gateway', [
                'extensions' => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
                'mime_types' => ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'],
                'max_kb' => 2048,
                'field' => 'image',
            ]);
        } else {
            unset($data['image']);
        }

        if (array_key_exists('parameters', $data)) {
            if (is_array($data['parameters'])) {
                $data['parameters'] = $this->normalizeParameters($data['parameters']);
            } else {
                $data['parameters'] = [];
            }
        }

        return $gateway->update($data);
    }

    private function normalizeParameters(array $parameters): array
    {
        if (array_is_list($parameters)) {
            return collect($parameters)
                ->map(function ($item) {
                    if (!is_array($item)) {
                        return null;
                    }

                    return [
                        'name' => trim((string) ($item['name'] ?? '')),
                        'label' => trim((string) ($item['label'] ?? '')),
                        'type' => in_array(($item['type'] ?? 'text'), ['text', 'file', 'textarea'], true)
                            ? $item['type']
                            : 'text',
                        'is_required' => (bool) ($item['is_required'] ?? false),
                    ];
                })
                ->filter(fn ($item) => $item && $item['name'] !== '' && $item['label'] !== '')
                ->values()
                ->all();
        }

        return collect($parameters)
            ->mapWithKeys(function ($value, $key) {
                return [(string) $key => is_scalar($value) ? (string) $value : ''];
            })
            ->all();
    }
}
