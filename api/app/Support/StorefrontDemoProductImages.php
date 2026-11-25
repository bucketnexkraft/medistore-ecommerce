<?php

namespace App\Support;

final class StorefrontDemoProductImages
{
    private const PRODUCT_IMAGES = [
        'demo-pet-supplies-10-pet-shampoo' => 'omron-jpn750',
        'demo-jewelry-accessories-03-leather-belt' => 'mesh-nebulizer-tz',
        'demo-jewelry-accessories-02-classic-watch' => 'mesh-nebulizer-jsl',
        'demo-jewelry-accessories-01-minimal-necklace' => 'mindray-ba88a',
        'demo-sports-fitness-10-fitness-towel' => 'autolumo-a1860',
    ];

    public static function slugs(): array
    {
        return array_keys(self::PRODUCT_IMAGES);
    }

    public static function thumbnailForSlug(string $slug): string
    {
        $image = self::PRODUCT_IMAGES[$slug] ?? null;

        return $image === null
            ? ''
            : public_asset_url('images/product-images/demo-medical/' . $image . '-main.webp');
    }

    public static function forSlug(string $slug): array
    {
        $image = self::PRODUCT_IMAGES[$slug] ?? null;

        if ($image === null) {
            return [];
        }

        $path = 'images/product-images/demo-medical/' . $image;

        return [
            self::thumbnailForSlug($slug),
            public_asset_url($path . '-alternate.webp'),
        ];
    }
}
