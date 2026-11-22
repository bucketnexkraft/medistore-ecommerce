<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Unit;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EcommerceDemoDataSeeder extends Seeder
{
    private int $featuredDemoProductCount = 0;
    private ?string $demoSeedBatchKey = null;

    private array $demoProductImages = [
        '1782295943_6a3bad8743cd9.jpg',
        '1782389540_6a3d1b247cbdf.png',
        '1782389754_6a3d1bfa2b745.jpeg',
        '1782389754_6a3d1bfa2c573.jpeg',
        '1782389780_6a3d1c14302fe.jpg',
        '1782479760_6a3e7b900c24e.jpg',
    ];

    private array $demoCategoryImages = [
        '120668.jpg',
        '2147856118.jpg',
        '2148837302.jpg',
    ];

    private array $demoBrandImages = [
        'png-transparent-laptop-dell-logo-computer-dell-e16hv-dell-poweredge-r430-computer-monitors-dell-inspiron-15-3000-series.png',
        'hp.jpg',
        'png-transparent-samsung-electronics-samsung-galaxy-samsung-logo-text-logo-black-thumbnail.png',
        'png-transparent-xiaomi-logo-icon.png',
        'png-transparent-wikipedia-logo-logitech-gmbh-font-rusia-2018-logo-emblem-text-logo-thumbnail.png',
    ];

    public function run(): void
    {
        $this->seedForCategory(null, null);
    }

    public function seedForCategory(?string $categoryTitle = null, ?string $companyId = null): void
    {
        $appendOnly = ! empty($companyId);
        $this->demoSeedBatchKey = $appendOnly ? Str::upper(Str::random(6)) : null;

        DB::transaction(function () use ($appendOnly, $categoryTitle, $companyId) {
            if (! $appendOnly) {
                $this->purgeOldDemoData($companyId);
            }

            $categories = $this->seedCategories($companyId, $appendOnly);
            $brands = $this->seedBrands($companyId, $appendOnly);
            $units = $this->seedUnits($companyId, $appendOnly);
            $variants = $this->seedVariants($companyId, $appendOnly);
            $this->seedProducts($categories, $brands, $units, $variants, $categoryTitle, $companyId, $appendOnly);
        });
    }

    private function seedCategories(?string $companyId = null, bool $appendOnly = false): array
    {
        $items = [
            ['title' => 'Electronics & Gadgets', 'status' => 1, 'is_show_in_category_header' => true, 'is_demo' => true],
            ['title' => 'Fashion & Apparel', 'status' => 1, 'is_show_in_category_header' => true, 'is_demo' => true],
            ['title' => 'Groceries & Essentials', 'status' => 1, 'is_show_in_category_header' => true, 'is_demo' => true],
            ['title' => 'Home & Kitchen', 'status' => 1, 'is_show_in_category_header' => true, 'is_demo' => true],
            ['title' => 'Health & Beauty', 'status' => 1, 'is_show_in_category_header' => true, 'is_demo' => true],
        ];

        $records = [];

        foreach ($items as $item) {
            $category = Category::withoutGlobalScopes()->firstOrNew([
                'title' => $item['title'],
                'company_id' => $companyId,
            ]);

            if ($appendOnly && $category->exists) {
                $records[$item['title']] = $category;

                continue;
            }

            $category->title = $item['title'];
            $category->company_id = $companyId;
            $category->status = $item['status'];
            $category->is_show_in_category_header = $item['is_show_in_category_header'];
            $category->is_demo = $appendOnly ? false : $item['is_demo'];
            if ($appendOnly) {
                $category->image = $this->demoCategoryImageForIndex(count($records));
            }
            $category->save();

            $records[$item['title']] = $category;
        }

        return $records;
    }

    private function seedBrands(?string $companyId = null, bool $appendOnly = false): array
    {
        $items = [
            ['title' => 'Nova Demo', 'is_demo' => true],
            ['title' => 'Urban Loom', 'is_demo' => true],
            ['title' => 'FreshNest', 'is_demo' => true],
            ['title' => 'Hearth & Home', 'is_demo' => true],
            ['title' => 'GlowLab', 'is_demo' => true],
        ];

        $records = [];

        foreach ($items as $item) {
            $brand = Brand::withoutGlobalScopes()->firstOrNew([
                'title' => $item['title'],
                'company_id' => $companyId,
            ]);

            if ($appendOnly && $brand->exists) {
                $records[$item['title']] = $brand;

                continue;
            }

            $brand->title = $item['title'];
            $brand->company_id = $companyId;
            $brand->status = 1;
            $brand->is_demo = $appendOnly ? false : $item['is_demo'];
            if ($appendOnly) {
                $brand->image = $this->demoBrandImageForIndex(count($records));
            }
            $brand->save();

            $records[$item['title']] = $brand;
        }

        return $records;
    }

    private function seedUnits(?string $companyId = null, bool $appendOnly = false): array
    {
        $items = [
            ['unit_code' => 'PCS', 'unit_name' => 'Piece', 'base_unit' => 0, 'operator' => '*', 'operation_value' => 1, 'is_demo' => true],
            ['unit_code' => 'BOX', 'unit_name' => 'Box', 'base_unit' => 0, 'operator' => '*', 'operation_value' => 1, 'is_demo' => true],
            ['unit_code' => 'PACK', 'unit_name' => 'Pack', 'base_unit' => 0, 'operator' => '*', 'operation_value' => 1, 'is_demo' => true],
            ['unit_code' => 'SET', 'unit_name' => 'Set', 'base_unit' => 0, 'operator' => '*', 'operation_value' => 1, 'is_demo' => true],
        ];

        $records = [];

        foreach ($items as $item) {
            $unit = Unit::query()->firstOrNew([
                'unit_code' => $item['unit_code'],
                'company_id' => $companyId,
            ]);

            if ($appendOnly && $unit->exists) {
                $records[$item['unit_code']] = $unit;

                continue;
            }

            $unit->unit_code = $item['unit_code'];
            $unit->company_id = $companyId;
            $unit->unit_name = $item['unit_name'];
            $unit->base_unit = $item['base_unit'];
            $unit->operator = $item['operator'];
            $unit->operation_value = $item['operation_value'];
            $unit->is_active = 1;
            $unit->is_demo = $appendOnly ? false : $item['is_demo'];
            $unit->save();

            $records[$item['unit_code']] = $unit;
        }

        return $records;
    }

    private function seedVariants(?string $companyId = null, bool $appendOnly = false): array
    {
        $items = [
            [
                'name' => 'Color',
                'attributes' => ['Black', 'White', 'Blue', 'Green'],
            ],
            [
                'name' => 'Size',
                'attributes' => ['S', 'M', 'L', 'XL'],
            ],
            [
                'name' => 'Storage',
                'attributes' => ['64 GB', '128 GB', '256 GB'],
            ],
        ];

        $records = [];

        foreach ($items as $item) {
            $variant = $appendOnly ? new ProductVariant() : ProductVariant::query()->updateOrCreate(
                ['name' => $item['name'], 'company_id' => $companyId],
                ['status' => 1, 'is_demo' => true, 'company_id' => $companyId],
            );
            $variant->name = $item['name'];
            $variant->status = 1;
            $variant->is_demo = $appendOnly ? false : true;
            $variant->company_id = $companyId;
            $variant->save();

            if (! $appendOnly) {
                $variant->attributes()->delete();
            }

            foreach ($item['attributes'] as $attribute) {
                $variant->attributes()->create([
                    'attribute_value' => $attribute,
                    'is_demo' => $appendOnly ? false : true,
                    'company_id' => $companyId,
                ]);
            }

            $records[$item['name']] = $variant->load('attributes');
        }

        return $records;
    }

    private function seedProducts(
        array $categories,
        array $brands,
        array $units,
        array $variants,
        ?string $categoryTitle = null,
        ?string $companyId = null,
        bool $appendOnly = false
    ): void
    {
        $this->featuredDemoProductCount = 0;

        $catalog = [
            'Electronics & Gadgets' => [
                'brand' => 'Nova Demo',
                'unit' => 'PCS',
                'quantity_base' => 42,
                'price_base' => 99,
                'purchase_base' => 65,
                'demand_tags' => ['trending', 'best_seller'],
                'descriptors' => [
                    'Smart Speaker',
                    'Wireless Earbuds',
                    'Bluetooth Watch',
                    'Gaming Mouse',
                    'Fast Charger',
                    'Smart Lamp',
                    'Mini Projector',
                    'Power Bank',
                    'Tablet Stand',
                    'Webcam',
                    'Soundbar',
                    'Router',
                    'Phone Case',
                    'USB Hub',
                    'Mechanical Keyboard',
                    'Portable Fan',
                    'LED Strip',
                    'Drone',
                    'Fitness Band',
                    'Smart Plug',
                ],
                'variant_sets' => [
                    [['Color' => 'Black', 'Storage' => '64 GB'], ['Color' => 'White', 'Storage' => '128 GB']],
                    [['Color' => 'Black'], ['Color' => 'Blue']],
                    [['Storage' => '64 GB'], ['Storage' => '128 GB']],
                    [['Color' => 'Gray'], ['Color' => 'Red']],
                ],
            ],
            'Fashion & Apparel' => [
                'brand' => 'Urban Loom',
                'unit' => 'PCS',
                'quantity_base' => 120,
                'price_base' => 24,
                'purchase_base' => 11,
                'demand_tags' => ['popular', 'seasonal'],
                'descriptors' => [
                    'Cotton T-Shirt',
                    'Slim Fit Jeans',
                    'Hoodie',
                    'Sneakers',
                    'Polo Shirt',
                    'Casual Shirt',
                    'Jacket',
                    'Cap',
                    'Tote Bag',
                    'Socks Pack',
                    'Sweatshirt',
                    'Dress',
                    'Belt',
                    'Scarf',
                    'Tracksuit',
                    'Shorts',
                    'Shirt',
                    'Sandals',
                    'Backpack',
                    'Blazer',
                ],
                'variant_sets' => [
                    [['Color' => 'Black', 'Size' => 'M'], ['Color' => 'White', 'Size' => 'L']],
                    [['Color' => 'Navy', 'Size' => 'L'], ['Color' => 'Olive', 'Size' => 'XL']],
                    [['Color' => 'Beige', 'Size' => 'S'], ['Color' => 'Black', 'Size' => 'M']],
                    [['Color' => 'Blue', 'Size' => 'L'], ['Color' => 'Gray', 'Size' => 'XL']],
                ],
            ],
            'Groceries & Essentials' => [
                'brand' => 'FreshNest',
                'unit' => 'PACK',
                'quantity_base' => 90,
                'price_base' => 18.5,
                'purchase_base' => 9.25,
                'demand_tags' => ['popular', 'most_sold'],
                'descriptors' => [
                    'Snack Box',
                    'Breakfast Cereal',
                    'Organic Honey',
                    'Premium Rice',
                    'Coffee Blend',
                    'Herbal Tea',
                    'Pasta Pack',
                    'Olive Oil',
                    'Nut Mix',
                    'Spices Set',
                    'Juice Pack',
                    'Chocolate Pack',
                    'Energy Bar',
                    'Fruit Jam',
                    'Oats Pack',
                    'Instant Noodles',
                    'Pickle Jar',
                    'Biscuit Box',
                    'Milk Powder',
                    'Salad Kit',
                ],
                'variant_sets' => [
                    [['Size' => 'Small'], ['Size' => 'Large']],
                    [['Pack' => 'Single'], ['Pack' => 'Family']],
                    [['Size' => '500g'], ['Size' => '1kg']],
                    [['Pack' => '2pc'], ['Pack' => '6pc']],
                ],
            ],
            'Home & Kitchen' => [
                'brand' => 'Hearth & Home',
                'unit' => 'SET',
                'quantity_base' => 28,
                'price_base' => 149,
                'purchase_base' => 92,
                'demand_tags' => ['top_rated', 'imported'],
                'descriptors' => [
                    'Cookware Set',
                    'Storage Basket',
                    'Desk Lamp',
                    'Wall Clock',
                    'Ceramic Mug Set',
                    'Pillow Cover',
                    'Dish Rack',
                    'Curtain Set',
                    'Knife Set',
                    'Cushion Set',
                    'Laundry Basket',
                    'Bed Sheet',
                    'Shower Curtain',
                    'Shelf Organizer',
                    'Vacuum Bottle',
                    'Laundry Hanger',
                    'Table Mat',
                    'Floor Mat',
                    'Plant Pot',
                    'Table Runner',
                ],
                'variant_sets' => [
                    [['Color' => 'Ivory', 'Size' => 'M'], ['Color' => 'Charcoal', 'Size' => 'L']],
                    [['Color' => 'Beige'], ['Color' => 'Sand']],
                    [['Style' => 'Classic'], ['Style' => 'Modern']],
                    [['Pack' => '2pc'], ['Pack' => '4pc']],
                ],
            ],
            'Health & Beauty' => [
                'brand' => 'GlowLab',
                'unit' => 'PCS',
                'quantity_base' => 64,
                'price_base' => 38,
                'purchase_base' => 19,
                'demand_tags' => ['trending', 'top_rated'],
                'descriptors' => [
                    'Glow Serum',
                    'Face Wash',
                    'Sunscreen',
                    'Lip Balm',
                    'Moisturizer',
                    'Night Cream',
                    'Sheet Mask',
                    'Hair Oil',
                    'Body Lotion',
                    'Shampoo',
                    'Conditioner',
                    'Toner',
                    'Face Mist',
                    'Eyeliner',
                    'Mascara',
                    'Scrub',
                    'Face Pack',
                    'Hand Cream',
                    'Deodorant',
                    'Perfume Roll-On',
                ],
                'variant_sets' => [
                    [['Size' => '30 ml'], ['Size' => '50 ml']],
                    [['Size' => '100 ml'], ['Size' => '200 ml']],
                    [['Type' => 'Daily'], ['Type' => 'Night']],
                    [['Fragrance' => 'Fresh'], ['Fragrance' => 'Floral']],
                ],
            ],
        ];

        if (trim((string) $categoryTitle) !== '') {
            $categoryTitle = trim($categoryTitle);
            $catalog = array_filter(
                $catalog,
                fn ($definition, $title) => $title === $categoryTitle,
                ARRAY_FILTER_USE_BOTH
            );

            if (empty($catalog)) {
                $catalog = [
                    'Electronics & Gadgets' => [
                        'brand' => 'Nova Demo',
                        'unit' => 'PCS',
                        'quantity_base' => 42,
                        'price_base' => 99,
                        'purchase_base' => 65,
                        'demand_tags' => ['trending', 'best_seller'],
                        'descriptors' => [
                            'Smart Speaker',
                            'Wireless Earbuds',
                            'Bluetooth Watch',
                            'Gaming Mouse',
                            'Fast Charger',
                            'Smart Lamp',
                            'Mini Projector',
                            'Power Bank',
                            'Tablet Stand',
                            'Webcam',
                            'Soundbar',
                            'Router',
                            'Phone Case',
                            'USB Hub',
                            'Mechanical Keyboard',
                            'Portable Fan',
                            'LED Strip',
                            'Drone',
                            'Fitness Band',
                            'Smart Plug',
                        ],
                        'variant_sets' => [
                            [['Color' => 'Black', 'Storage' => '64 GB'], ['Color' => 'White', 'Storage' => '128 GB']],
                            [['Color' => 'Black'], ['Color' => 'Blue']],
                            [['Storage' => '64 GB'], ['Storage' => '128 GB']],
                            [['Color' => 'Gray'], ['Color' => 'Red']],
                        ],
                    ],
                    'Fashion & Apparel' => [
                        'brand' => 'Urban Loom',
                        'unit' => 'PCS',
                        'quantity_base' => 120,
                        'price_base' => 24,
                        'purchase_base' => 11,
                        'demand_tags' => ['popular', 'seasonal'],
                        'descriptors' => [
                            'Cotton T-Shirt',
                            'Slim Fit Jeans',
                            'Hoodie',
                            'Sneakers',
                            'Polo Shirt',
                            'Casual Shirt',
                            'Jacket',
                            'Cap',
                            'Tote Bag',
                            'Socks Pack',
                            'Sweatshirt',
                            'Dress',
                            'Belt',
                            'Scarf',
                            'Tracksuit',
                            'Shorts',
                            'Shirt',
                            'Sandals',
                            'Backpack',
                            'Blazer',
                        ],
                        'variant_sets' => [
                            [['Color' => 'Black', 'Size' => 'M'], ['Color' => 'White', 'Size' => 'L']],
                            [['Color' => 'Navy', 'Size' => 'L'], ['Color' => 'Olive', 'Size' => 'XL']],
                            [['Color' => 'Beige', 'Size' => 'S'], ['Color' => 'Black', 'Size' => 'M']],
                            [['Color' => 'Blue', 'Size' => 'L'], ['Color' => 'Gray', 'Size' => 'XL']],
                        ],
                    ],
                    'Groceries & Essentials' => [
                        'brand' => 'FreshNest',
                        'unit' => 'PACK',
                        'quantity_base' => 90,
                        'price_base' => 18.5,
                        'purchase_base' => 9.25,
                        'demand_tags' => ['popular', 'most_sold'],
                        'descriptors' => [
                            'Snack Box',
                            'Breakfast Cereal',
                            'Organic Honey',
                            'Premium Rice',
                            'Coffee Blend',
                            'Herbal Tea',
                            'Pasta Pack',
                            'Olive Oil',
                            'Nut Mix',
                            'Spices Set',
                            'Juice Pack',
                            'Chocolate Pack',
                            'Energy Bar',
                            'Fruit Jam',
                            'Oats Pack',
                            'Instant Noodles',
                            'Pickle Jar',
                            'Biscuit Box',
                            'Milk Powder',
                            'Salad Kit',
                        ],
                        'variant_sets' => [
                            [['Size' => 'Small'], ['Size' => 'Large']],
                            [['Pack' => 'Single'], ['Pack' => 'Family']],
                            [['Size' => '500g'], ['Size' => '1kg']],
                            [['Pack' => '2pc'], ['Pack' => '6pc']],
                        ],
                    ],
                    'Home & Kitchen' => [
                        'brand' => 'Hearth & Home',
                        'unit' => 'SET',
                        'quantity_base' => 28,
                        'price_base' => 149,
                        'purchase_base' => 92,
                        'demand_tags' => ['top_rated', 'imported'],
                        'descriptors' => [
                            'Cookware Set',
                            'Storage Basket',
                            'Desk Lamp',
                            'Wall Clock',
                            'Ceramic Mug Set',
                            'Pillow Cover',
                            'Dish Rack',
                            'Curtain Set',
                            'Knife Set',
                            'Cushion Set',
                            'Laundry Basket',
                            'Bed Sheet',
                            'Shower Curtain',
                            'Shelf Organizer',
                            'Vacuum Bottle',
                            'Laundry Hanger',
                            'Table Mat',
                            'Floor Mat',
                            'Plant Pot',
                            'Table Runner',
                        ],
                        'variant_sets' => [
                            [['Color' => 'Ivory', 'Size' => 'M'], ['Color' => 'Charcoal', 'Size' => 'L']],
                            [['Color' => 'Beige'], ['Color' => 'Sand']],
                            [['Style' => 'Classic'], ['Style' => 'Modern']],
                            [['Pack' => '2pc'], ['Pack' => '4pc']],
                        ],
                    ],
                    'Health & Beauty' => [
                        'brand' => 'GlowLab',
                        'unit' => 'PCS',
                        'quantity_base' => 64,
                        'price_base' => 38,
                        'purchase_base' => 19,
                        'demand_tags' => ['trending', 'top_rated'],
                        'descriptors' => [
                            'Glow Serum',
                            'Face Wash',
                            'Sunscreen',
                            'Lip Balm',
                            'Moisturizer',
                            'Night Cream',
                            'Sheet Mask',
                            'Hair Oil',
                            'Body Lotion',
                            'Shampoo',
                            'Conditioner',
                            'Toner',
                            'Face Mist',
                            'Eyeliner',
                            'Mascara',
                            'Scrub',
                            'Face Pack',
                            'Hand Cream',
                            'Deodorant',
                            'Perfume Roll-On',
                        ],
                        'variant_sets' => [
                            [['Size' => '30 ml'], ['Size' => '50 ml']],
                            [['Size' => '100 ml'], ['Size' => '200 ml']],
                            [['Type' => 'Daily'], ['Type' => 'Night']],
                            [['Fragrance' => 'Fresh'], ['Fragrance' => 'Floral']],
                        ],
                    ],
                ];
            }
        }

        foreach ($catalog as $categoryTitle => $definition) {
            $category = $categories[$categoryTitle] ?? null;
            $brand = $brands[$definition['brand']] ?? null;
            $unit = $units[$definition['unit']] ?? null;

            if (! $category || ! $brand || ! $unit) {
                continue;
            }

            foreach ($definition['descriptors'] as $index => $descriptor) {
                $productNumber = str_pad((string) ($index + 1), 2, '0', STR_PAD_LEFT);
                $productCode = $this->buildDemoProductCode($categoryTitle, $productNumber, $appendOnly);
                $productName = 'Demo ' . $descriptor;
                $variantSet = $definition['variant_sets'][$index % count($definition['variant_sets'])];
                $quantity = (int) ($definition['quantity_base'] + ($index * 2));
                $price = round((float) $definition['price_base'] + ($index * 1.75), 2);
                $purchasePrice = round((float) $definition['purchase_base'] + ($index * 1.1), 2);
                $productVariants = array_values($variantSet);

                $product = $appendOnly ? new Product() : Product::query()->firstOrNew([
                    'code' => $productCode,
                    'company_id' => $companyId,
                ]);
                $product->code = $productCode;
                $product->name = $productName;
                $product->company_id = $companyId;
                $product->brand_id = $brand->id;
                $product->category_id = $category->id;
                $product->unit_id = $unit->id;
                $productImage = $this->demoProductImageForIndex($index);
                $product->thumbnail = $productImage;
                $product->featured_image = $productImage;
                $product->images = json_encode($this->demoProductGalleryForIndex($index));
                $product->status = 1;
                $product->description = sprintf(
                    'Demo %s for %s with a storefront-ready catalog entry.',
                    strtolower($descriptor),
                    $categoryTitle
                );
                $product->shipping_information = 'Ships within 1 to 2 business days.';
                $product->return_information = 'Demo return window of 7 days for unopened items.';
                $product->return_policy = 'Standard demo return policy applies.';
                $product->is_free = false;
                $product->meta_title = $productName;
                $product->meta_tags = json_encode([$productCode, $categoryTitle, $definition['brand']]);
                $product->meta_descriptions = sprintf('Demo product for %s.', $categoryTitle);
                $product->has_variant = true;
                $product->has_segment = false;
                $product->variants = $productVariants;
                $product->segmentation = [];
                $product->vat = 5;
                $product->sales_channel = ['online_store', 'pos_store'];
                $product->demand_tags = $definition['demand_tags'];
                $product->stock_visibility = true;
                $product->stock_visibility_label = null;
                $product->is_demo = $appendOnly ? false : true;
                $product->is_featured = $this->featuredDemoProductCount < 3;
                if ($product->is_featured) {
                    $this->featuredDemoProductCount++;
                }
                $product->is_bundle = false;
                $product->bundle_uuid = null;
                $product->is_group_purchase_available = false;
                $product->group_purchase_discount_type = null;
                $product->group_purchase_minimum_user = null;
                $product->group_purchase_discount_amount = null;

                if (empty($product->id)) {
                    $product->id = $this->makeProductId();
                }

                $product->slug = $this->buildProductSlug($product->code, $brand->title, $product->name, $product->id);
                $product->saveQuietly();

                $inventory = Inventory::query()
                    ->where('product_id', $product->id)
                    ->whereNull('warehouse_id')
                    ->first();

                if (! $inventory) {
                    $inventory = new Inventory();
                    $inventory->product_id = $product->id;
                    $inventory->company_id = $companyId;
                    $inventory->warehouse_id = null;
                }

                $inventory->quantity = $quantity;
                $inventory->alert_quantity = 5;
                $inventory->stock_out_mood = 'FIFO';
                $inventory->save();

                $inventoryItem = InventoryItem::query()
                    ->where('inventory_id', $inventory->id)
                    ->first();

                if (! $inventoryItem) {
                    $inventoryItem = new InventoryItem();
                    $inventoryItem->inventory_id = $inventory->id;
                    $inventoryItem->product_id = $product->id;
                    $inventoryItem->company_id = $companyId;
                }

                $inventoryItem->warehouse_id = null;
                $inventoryItem->product_id = $product->id;
                $inventoryItem->lot_number = null;
                $inventoryItem->expiry_date = null;
                $inventoryItem->barcode = $productCode;
                $inventoryItem->sku = $productCode;
                $inventoryItem->quantity = $quantity;
                $inventoryItem->variant_id = null;
                $inventoryItem->segmentations = null;
                $inventoryItem->price = $price;
                $inventoryItem->purchase_price = $purchasePrice;
                $inventoryItem->price_json = null;
                $inventoryItem->stock_out_mood = 'FIFO';
                $inventoryItem->discount_amount = 0;
                $inventoryItem->discount_type = null;
                $inventoryItem->alert_quantity = 5;
                $inventoryItem->save();
            }
        }
    }

    private function demoProductImageForIndex(int $index): string
    {
        return $this->demoProductAssetForIndex(
            $this->demoProductImages,
            $index,
            'product',
            'product-images'
        );
    }

    private function demoProductGalleryForIndex(int $index): array
    {
        $startIndex = $index % count($this->demoProductImages);

        return collect(range(0, 2))
            ->map(function (int $offset) use ($startIndex) {
                $fileName = $this->demoProductImages[($startIndex + $offset) % count($this->demoProductImages)];
                $this->ensureDemoAssetCopied('product', 'product-images', $fileName);

                return $fileName;
            })
            ->unique()
            ->values()
            ->all();
    }

    private function demoCategoryImageForIndex(int $index): string
    {
        return $this->demoProductAssetForIndex(
            $this->demoCategoryImages,
            $index,
            'category',
            'category-images'
        );
    }

    private function demoBrandImageForIndex(int $index): string
    {
        return $this->demoProductAssetForIndex(
            $this->demoBrandImages,
            $index,
            'brand',
            'brand-images'
        );
    }

    private function demoProductAssetForIndex(
        array $assets,
        int $index,
        string $sourceFolder,
        string $targetFolder
    ): string {
        $fileName = $assets[$index % count($assets)];
        $this->ensureDemoAssetCopied($sourceFolder, $targetFolder, $fileName);

        return $fileName;
    }

    private function ensureDemoAssetCopied(string $sourceFolder, string $targetFolder, string $fileName): void
    {
        $sourcePath = public_path('images/demo/' . trim($sourceFolder, '/') . '/' . ltrim($fileName, '/'));
        $targetDirectory = public_path('images/' . trim($targetFolder, '/'));
        $targetPath = $targetDirectory . '/' . ltrim($fileName, '/');

        if (! File::exists($sourcePath)) {
            return;
        }

        if (! File::exists($targetDirectory)) {
            File::makeDirectory($targetDirectory, 0755, true);
        }

        if (! File::exists($targetPath)) {
            File::copy($sourcePath, $targetPath);
        }
    }

    private function buildDemoProductCode(string $categoryTitle, string $productNumber, bool $appendOnly = false): string
    {
        $categoryKey = Str::upper(Str::slug($categoryTitle, ''));

        if ($appendOnly && ! empty($this->demoSeedBatchKey)) {
            return sprintf('DEMO-%s-%s-%s', $categoryKey, $productNumber, $this->demoSeedBatchKey);
        }

        return sprintf('DEMO-%s-%s', $categoryKey, $productNumber);
    }

    private function purgeOldDemoData(?string $companyId = null): void
    {
        InventoryItem::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->whereHas('product', function ($query) {
                $query->where('code', 'like', 'DEMO-%');
            })
            ->delete();

        Inventory::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->whereHas('product', function ($query) {
                $query->where('code', 'like', 'DEMO-%');
            })
            ->delete();

        Product::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('code', 'like', 'DEMO-%')
            ->forceDelete();

        Category::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('title', 'like', 'Demo %')
            ->delete();

        Brand::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->where('title', 'like', '%Demo%')
            ->delete();

        Unit::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->whereIn('unit_code', ['PCS', 'BOX', 'PACK', 'SET'])
            ->delete();

        ProductVariant::query()
            ->when($companyId, fn ($query) => $query->where('company_id', $companyId))
            ->whereIn('name', ['Color', 'Size', 'Storage'])
            ->delete();
    }

    private function buildProductSlug(string $code, string $brandTitle, string $name, ?string $productId = null): string
    {
        $baseSlug = Str::slug($code . '-' . $brandTitle . '-' . $name);
        $slug = $baseSlug;
        $suffix = 2;

        while (Product::query()
            ->where('slug', $slug)
            ->when($productId !== null, fn ($query) => $query->where('id', '!=', $productId))
            ->exists()) {
            $slug = $baseSlug . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    private function makeProductId(): string
    {
        return substr(uniqid(), 0, 13) . '-prod-' . random_int(10000000000000000, 99999999999999999);
    }
}
