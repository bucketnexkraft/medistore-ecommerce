<?php

namespace Database\Seeders;

use App\Enums\StorefrontSectionPreset;
use App\Models\ECategory;
use App\Models\ESectionPreset;
use App\Models\ETemplate;
use App\Support\StorefrontCategorySectionCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class EcommerceCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $categoryNames = StorefrontCategorySectionCatalog::categoryNames();

        if (! is_array($categoryNames) || empty($categoryNames)) {
            $categoryNames = [
                'Fashion & Apparel',
                'Electronics & Gadgets',
                'Groceries & Essentials',
                'Home & Kitchen',
                'Health & Beauty',
                'Sports & Fitness',
                'Jewelry & Accessories',
                'Toys & Kids',
                'Books & Stationery',
                'Pet Supplies',
            ];
        }

        foreach ($categoryNames as $name) {
            ECategory::query()->updateOrCreate(
                ['name' => $name],
                ['status' => true]
            );
        }

        $categories = ECategory::query()
            ->whereIn('name', $categoryNames)
            ->get(['id', 'name'])
            ->keyBy('name');

        $templates = [
            [
                'template_name' => 'Urban Fashion Hub',
                'categories' => ['Fashion & Apparel'],
                'tags' => ['modern', 'catalog', 'trendy'],
            ],
            [
                'template_name' => 'Electro Mart Prime',
                'categories' => ['Electronics & Gadgets'],
                'tags' => ['gadgets', 'flash-sale', 'tech'],
            ],
            [
                'template_name' => 'Cozy Living Store',
                'categories' => ['Home & Kitchen'],
                'tags' => ['minimal', 'home', 'lifestyle'],
            ],
            [
                'template_name' => 'Glow Beauty Market',
                'categories' => ['Health & Beauty'],
                'tags' => ['cosmetics', 'clean-look', 'premium'],
            ],
            [
                'template_name' => 'Fresh Basket Shop',
                'categories' => ['Groceries & Essentials'],
                'tags' => ['fresh', 'daily-needs', 'family'],
            ],
            [
                'template_name' => 'Active Sports Arena',
                'categories' => ['Health & Beauty', 'Fashion & Apparel'],
                'tags' => ['fitness', 'performance', 'outdoor'],
            ],
            [
                'template_name' => 'Reader Corner',
                'categories' => ['Home & Kitchen'],
                'tags' => ['editorial', 'knowledge', 'classic'],
            ],
            [
                'template_name' => 'Kids Joy Plaza',
                'categories' => ['Fashion & Apparel', 'Home & Kitchen'],
                'tags' => ['kids', 'playful', 'bright'],
            ],
            [
                'template_name' => 'Luxury Spark Studio',
                'categories' => ['Fashion & Apparel', 'Health & Beauty'],
                'tags' => ['luxury', 'elegant', 'gift'],
            ],
            [
                'template_name' => 'Happy Paws Market',
                'categories' => ['Groceries & Essentials', 'Home & Kitchen'],
                'tags' => ['pets', 'care', 'community'],
            ],
        ];

        foreach ($templates as $template) {
            ETemplate::query()->updateOrCreate(
                ['template_name' => $template['template_name']],
                [
                    'image' => null,
                    'categories' => $this->mapCategoryNames($template['categories'], $categories),
                    'tags' => $template['tags'],
                ]
            );
        }

        $presetDefinitions = collect(StorefrontCategorySectionCatalog::definitions())
            ->keyBy('preset_key')
            ->all();

        $presetKeys = array_keys($presetDefinitions);
        $managedCategoryPrefixes = collect(StorefrontCategorySectionCatalog::catalog())
            ->keys()
            ->map(fn (string $categoryKey) => $categoryKey . '-')
            ->values()
            ->all();

        ESectionPreset::query()
            ->get()
            ->filter(function (ESectionPreset $preset) use ($presetKeys, $managedCategoryPrefixes) {
                $presetKey = (string) $preset->preset_key;

                if (in_array($presetKey, $presetKeys, true)) {
                    return false;
                }

                return StorefrontSectionPreset::tryFromValue($presetKey) !== null
                    || collect($managedCategoryPrefixes)->contains(fn (string $prefix) => str_starts_with($presetKey, $prefix));
            })
            ->each(function (ESectionPreset $preset) {
                $preset->delete();
            });

        foreach ($presetDefinitions as $preset) {
            $linkedCategoryNames = [(string) $preset['category_name']];

            $model = ESectionPreset::query()->updateOrCreate(
                [
                    'preset_key' => $preset['preset_key'],
                ],
                [
                    'name' => $preset['name'],
                    'section_type' => $preset['section_type'],
                    'component_key' => $preset['component_key'],
                    'preview_image' => null,
                    'categories' => $this->mapCategoryNames($linkedCategoryNames, $categories),
                    'status' => true,
                ]
            );

            $this->syncPresetCategories($model, $linkedCategoryNames);
        }
    }

    private function mapCategoryNames(array $names, $categories): array
    {
        return collect($names)
            ->map(function (string $name) use ($categories) {
                $category = $categories->get($name);

                if (! $category) {
                    return null;
                }

                return [
                    'id' => $category->id,
                    'name' => $category->name,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function syncPresetCategories(ESectionPreset $preset, array $categoryNames): void
    {
        if (! Schema::hasTable('e_category_section_presets')) {
            return;
        }

        $categoryIds = collect($categoryNames)
            ->map(function (string $name) {
                $category = ECategory::query()->where('name', $name)->first(['id']);

                return $category?->id;
            })
            ->filter(fn ($value) => is_numeric($value))
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();

        $preset->linkedCategories()->sync(
            collect($categoryIds)
                ->mapWithKeys(fn (int $categoryId, int $index) => [$categoryId => ['sort_order' => $index + 1]])
                ->all()
        );
    }
}
