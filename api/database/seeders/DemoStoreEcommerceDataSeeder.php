<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Unit;
use App\Models\VariantAttribute;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class DemoStoreEcommerceDataSeeder extends Seeder
{
    private array $demoAssets = [];

    public function run(): void
    {
        $this->demoAssets = $this->discoverDemoAssets();

        if ($this->demoAssets === []) {
            throw new \RuntimeException('No demo images were found in api/public/images/demo.');
        }

        DB::transaction(function (): void {
            $this->purgeDemoCatalog();

            $categories = $this->seedCategories();
            $brands = $this->seedBrands();
            $units = $this->seedUnits();
            $this->seedVariants();

            $this->seedProducts($categories, $brands, $units);
        });

        $this->command?->info('Global demo ecommerce catalog seeded successfully without creating a store.');
    }

    private function seedCategories(): array
    {
        $names = [
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
        $records = [];

        foreach ($names as $index => $name) {
            $category = Category::withoutGlobalScopes()->firstOrNew([
                'company_id' => null,
                'title' => $name,
            ]);
            $category->company_id = null;
            $category->title = $name;
            $category->slug = Str::slug($name);
            $category->status = 1;
            $category->show_home = 1;
            $category->short_number = $index + 1;
            $category->is_show_in_category_header = true;
            $category->image = $this->demoImage('c', 'category-images', $index);
            $category->is_demo = true;
            $category->save();
            $records[$name] = $category;
        }

        return $records;
    }

    private function seedBrands(): array
    {
        $names = [
            'Luma Demo',
            'Urban Demo',
            'Fresh Demo',
            'Cozy Demo',
            'Glow Demo',
            'Active Demo',
            'Spark Demo',
            'Joy Demo',
            'Read Demo',
            'Paw Demo',
        ];
        $records = [];

        foreach ($names as $index => $name) {
            $brand = Brand::withoutGlobalScopes()->firstOrNew([
                'company_id' => null,
                'title' => $name,
            ]);
            $brand->company_id = null;
            $brand->title = $name;
            $brand->slug = Str::slug($name);
            $brand->status = 1;
            $brand->image = $this->demoImage('b', 'brand-images', $index);
            $brand->is_demo = true;
            $brand->save();
            $records[$name] = $brand;
        }

        return $records;
    }

    private function seedUnits(): array
    {
        $items = [
            ['PCS', 'Piece'],
            ['PAIR', 'Pair'],
            ['SET', 'Set'],
            ['PACK', 'Pack'],
            ['BOX', 'Box'],
            ['KG', 'Kilogram'],
            ['ML', 'Milliliter'],
        ];
        $records = [];

        foreach ($items as [$code, $name]) {
            $unit = Unit::query()->firstOrNew([
                'company_id' => null,
                'unit_code' => $code,
            ]);
            $unit->company_id = null;
            $unit->unit_code = $code;
            $unit->unit_name = $name;
            $unit->base_unit = 0;
            $unit->operator = '*';
            $unit->operation_value = 1;
            $unit->is_active = 1;
            $unit->is_demo = true;
            $unit->save();
            $records[$code] = $unit;
        }

        return $records;
    }

    private function seedVariants(): array
    {
        $items = [
            'Color' => ['Black', 'White', 'Navy', 'Rose'],
            'Size' => ['S', 'M', 'L', 'XL'],
            'Material' => ['Cotton', 'Leather', 'Stainless Steel', 'Bamboo'],
            'Storage' => ['64 GB', '128 GB', '256 GB'],
        ];
        $records = [];

        foreach ($items as $name => $attributes) {
            $variant = ProductVariant::withoutGlobalScopes()->firstOrNew([
                'company_id' => null,
                'name' => $name,
            ]);
            $variant->company_id = null;
            $variant->name = $name;
            $variant->status = 1;
            $variant->is_demo = true;
            $variant->save();

            foreach ($attributes as $value) {
                $attribute = VariantAttribute::withoutGlobalScopes()->firstOrNew([
                    'company_id' => null,
                    'product_variant_id' => $variant->id,
                    'attribute_value' => $value,
                ]);
                $attribute->company_id = null;
                $attribute->product_variant_id = $variant->id;
                $attribute->attribute_value = $value;
                $attribute->is_demo = true;
                $attribute->save();
            }

            $records[$name] = $variant;
        }

        return $records;
    }

    private function seedProducts(array $categories, array $brands, array $units): void
    {
        $catalog = [
            ['Fashion & Apparel', 'Luma Demo', 'PCS', 1290, ['Cotton Kurti', 'Linen Shirt', 'Relaxed T-Shirt', 'Denim Jacket', 'Pleated Skirt', 'Summer Dress', 'Cargo Pants', 'Classic Blazer', 'Knit Cardigan', 'Everyday Hoodie']],
            ['Electronics & Gadgets', 'Urban Demo', 'PCS', 15990, ['Smart Tablet', 'Wireless Earbuds', 'Fitness Watch', 'Bluetooth Speaker', 'Laptop Stand', 'Power Bank', 'USB-C Hub', 'Mechanical Keyboard', 'Smart Camera', 'Portable Charger']],
            ['Groceries & Essentials', 'Fresh Demo', 'BOX', 1490, ['Organic Pantry Box', 'Premium Rice', 'Coffee Blend', 'Herbal Tea', 'Pasta Pack', 'Olive Oil', 'Nut Mix', 'Spices Set', 'Juice Pack', 'Chocolate Pack']],
            ['Home & Kitchen', 'Cozy Demo', 'SET', 2490, ['Ceramic Dinner Set', 'Storage Basket', 'Desk Lamp', 'Wall Clock', 'Ceramic Mug Set', 'Pillow Cover', 'Dish Rack', 'Curtain Set', 'Knife Set', 'Cushion Set']],
            ['Health & Beauty', 'Glow Demo', 'ML', 990, ['Glow Serum', 'Face Wash', 'Sunscreen', 'Lip Balm', 'Moisturizer', 'Night Cream', 'Sheet Mask', 'Hair Oil', 'Body Lotion', 'Shampoo']],
            ['Sports & Fitness', 'Active Demo', 'PAIR', 2990, ['Training Sneaker', 'Yoga Mat', 'Gym Gloves', 'Running Shorts', 'Sports Bottle', 'Resistance Band', 'Training Bag', 'Cycling Helmet', 'Jump Rope', 'Fitness Towel']],
            ['Jewelry & Accessories', 'Spark Demo', 'PCS', 1790, ['Minimal Necklace', 'Classic Watch', 'Leather Belt', 'Hoop Earrings', 'Silk Scarf', 'Charm Bracelet', 'Sunglasses', 'Hair Clip Set', 'Card Holder', 'Pendant Set']],
            ['Toys & Kids', 'Joy Demo', 'BOX', 890, ['Learning Blocks', 'Puzzle Board', 'Plush Bear', 'Art Kit', 'Remote Car', 'Building Set', 'Story Cards', 'Play Tent', 'Doll House', 'Science Kit']],
            ['Books & Stationery', 'Read Demo', 'SET', 690, ['Story Book Collection', 'Daily Planner', 'Sketch Notebook', 'Color Pencil Set', 'Desk Organizer', 'Travel Journal', 'Study Lamp', 'Writing Pad', 'Bookmark Set', 'Reading Light']],
            ['Pet Supplies', 'Paw Demo', 'PACK', 1190, ['Pet Care Kit', 'Comfort Pet Bed', 'Cat Scratcher', 'Dog Leash', 'Pet Bowl Set', 'Grooming Brush', 'Training Treats', 'Pet Toy Pack', 'Travel Carrier', 'Pet Shampoo']],
        ];

        $productIndex = 0;

        foreach ($catalog as [$categoryName, $brandName, $unitCode, $basePrice, $names]) {
            $category = $categories[$categoryName];
            $brand = $brands[$brandName];
            $unit = $units[$unitCode];

            foreach ($names as $index => $name) {
                $number = $index + 1;
                $code = 'DEMO-' . Str::upper(Str::slug($categoryName, '-')) . '-' . str_pad((string) $number, 2, '0', STR_PAD_LEFT);
                $product = Product::withoutGlobalScopes()->firstOrNew([
                    'company_id' => null,
                    'code' => $code,
                ]);
                $product->company_id = null;
                $product->code = $code;
                $product->name = 'Demo ' . $name;
                $product->slug = Str::slug($code . '-' . $name);
                $product->brand_id = $brand->id;
                $product->category_id = $category->id;
                $product->unit_id = $unit->id;
                $productImage = $this->demoImage('f', 'product-images', $productIndex);
                $product->thumbnail = $productImage;
                $product->featured_image = $productImage;
                $product->images = json_encode($this->demoGallery($productIndex));
                $product->status = 1;
                $product->description = 'Demo ' . strtolower($name) . ' for ' . $categoryName . '.';
                $product->shipping_information = 'Ships within 1 to 2 business days.';
                $product->return_information = '7-day return available for unused items.';
                $product->return_policy = 'Standard demo return policy applies.';
                $product->is_free = false;
                $product->meta_title = $product->name . ' | Demo Catalog';
                $product->meta_tags = json_encode([$code, $categoryName, $brandName]);
                $product->meta_descriptions = 'Demo product for ' . $categoryName . '.';
                $product->has_variant = true;
                $product->has_segment = false;
                $product->variants = [$this->variantOptionsFor($categoryName)];
                $product->segmentation = [];
                $product->vat = 5;
                $product->sales_channel = ['online_store'];
                $product->demand_tags = $number <= 2 ? ['best_seller', 'trending'] : ['popular'];
                $product->stock_visibility = true;
                $product->stock_visibility_label = null;
                $product->is_demo = true;
                $product->is_featured = $productIndex < 8;
                $product->is_bundle = false;
                $product->bundle_uuid = null;
                $product->is_group_purchase_available = false;
                $product->group_purchase_discount_type = null;
                $product->group_purchase_minimum_user = null;
                $product->group_purchase_discount_amount = null;
                if (empty($product->id)) {
                    $product->id = substr(uniqid(), 0, 13) . '-prod-' . random_int(10000000000000000, 99999999999999999);
                }
                $product->saveQuietly();

                $quantity = 20 + (($number * 3) % 40);
                $price = (float) $basePrice + (($number - 1) * 25);
                $inventory = Inventory::withoutGlobalScopes()->withTrashed()->firstOrNew([
                    'company_id' => null,
                    'warehouse_id' => null,
                    'product_id' => $product->id,
                ]);
                $inventory->company_id = null;
                $inventory->warehouse_id = null;
                $inventory->product_id = $product->id;
                $inventory->quantity = $quantity;
                $inventory->alert_quantity = 5;
                $inventory->stock_out_mood = 'FIFO';
                if ($inventory->trashed()) {
                    $inventory->restore();
                }
                $inventory->save();

                $inventoryItem = InventoryItem::withoutGlobalScopes()->withTrashed()->firstOrNew([
                    'company_id' => null,
                    'inventory_id' => $inventory->id,
                    'warehouse_id' => null,
                    'product_id' => $product->id,
                ]);
                $inventoryItem->company_id = null;
                $inventoryItem->inventory_id = $inventory->id;
                $inventoryItem->warehouse_id = null;
                $inventoryItem->product_id = $product->id;
                $inventoryItem->barcode = $code;
                $inventoryItem->sku = $code;
                $inventoryItem->quantity = $quantity;
                $inventoryItem->variant_id = null;
                $inventoryItem->segmentations = null;
                $inventoryItem->price = $price;
                $inventoryItem->purchase_price = round($price * 0.62, 2);
                $inventoryItem->price_json = null;
                $inventoryItem->stock_out_mood = 'FIFO';
                $inventoryItem->discount_amount = 0;
                $inventoryItem->discount_type = null;
                $inventoryItem->alert_quantity = 5;
                if ($inventoryItem->trashed()) {
                    $inventoryItem->restore();
                }
                $inventoryItem->save();

                $productIndex++;
            }
        }
    }

    private function variantOptionsFor(string $categoryName): array
    {
        if ($categoryName === 'Electronics & Gadgets') {
            return ['Storage' => '128 GB', 'Color' => 'Black'];
        }

        if (in_array($categoryName, ['Groceries & Essentials', 'Home & Kitchen', 'Jewelry & Accessories', 'Toys & Kids'], true)) {
            return ['Material' => 'Bamboo'];
        }

        return ['Color' => 'Black', 'Size' => 'M'];
    }

    private function purgeDemoCatalog(): void
    {
        $demoProductIds = Product::withoutGlobalScopes()
            ->withTrashed()
            ->where('is_demo', true)
            ->pluck('id');

        if ($demoProductIds->isNotEmpty()) {
            InventoryItem::withoutGlobalScopes()->withTrashed()->whereIn('product_id', $demoProductIds)->forceDelete();
            Inventory::withoutGlobalScopes()->withTrashed()->whereIn('product_id', $demoProductIds)->forceDelete();
            Product::withoutGlobalScopes()->withTrashed()->whereIn('id', $demoProductIds)->forceDelete();
        }

        Category::withoutGlobalScopes()->where('is_demo', true)->delete();
        Brand::withoutGlobalScopes()->where('is_demo', true)->delete();
        Unit::query()->where('is_demo', true)->delete();

        $demoVariantIds = ProductVariant::withoutGlobalScopes()
            ->where('is_demo', true)
            ->pluck('id');

        if ($demoVariantIds->isNotEmpty()) {
            VariantAttribute::withoutGlobalScopes()->whereIn('product_variant_id', $demoVariantIds)->delete();
            ProductVariant::withoutGlobalScopes()->whereIn('id', $demoVariantIds)->delete();
        }

        VariantAttribute::withoutGlobalScopes()->where('is_demo', true)->delete();
    }

    private function discoverDemoAssets(): array
    {
        return collect(File::allFiles(public_path('images/demo')))
            ->filter(function ($file): bool {
                return in_array(strtolower($file->getExtension()), ['jpg', 'jpeg', 'png', 'gif', 'webp'], true);
            })
            ->map(fn ($file): string => $file->getPathname())
            ->values()
            ->all();
    }

    private function demoImage(string $prefix, string $targetFolder, int $index): string
    {
        $matchingAssets = array_values(array_filter(
            $this->demoAssets,
            fn (string $path): bool => str_starts_with(strtolower(pathinfo($path, PATHINFO_FILENAME)), $prefix . '-'),
        ));
        $assets = $matchingAssets !== [] ? $matchingAssets : $this->demoAssets;
        $sourcePath = $assets[random_int(0, count($assets) - 1)];
        $extension = strtolower(pathinfo($sourcePath, PATHINFO_EXTENSION));
        $fileName = $prefix . '-' . ($index + 1) . '.' . $extension;
        $targetDirectory = public_path('images/' . trim($targetFolder, '/'));
        $targetPath = $targetDirectory . '/' . $fileName;

        if (! File::exists($targetDirectory)) {
            File::makeDirectory($targetDirectory, 0755, true);
        }
        if (! File::exists($targetPath)) {
            File::copy($sourcePath, $targetPath);
        }

        return $fileName;
    }

    private function demoGallery(int $index): array
    {
        return collect(range(0, 2))
            ->map(fn (int $offset): string => $this->demoImage('f', 'product-images', $index + $offset))
            ->unique()
            ->values()
            ->all();
    }
}
