<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Company;
use App\Models\Inventory;
use App\Models\InventoryItem;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Unit;
use App\Models\VariantAttribute;
use App\Models\Warehouse;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MstoreEcommerceDataSeeder extends Seeder
{
    private const DOMAIN = 'mstore.ecommerce.com';

    public function run(): void
    {
        $company = Company::query()
            ->where(function ($query) {
                $query->where('domain', self::DOMAIN)
                    ->orWhere('custom_domain', self::DOMAIN);
            })
            ->first();

        if (! $company) {
            $this->command?->warn('mstore.ecommerce.com was not found; mstore seed skipped.');

            return;
        }

        DB::transaction(function () use ($company) {
            $categories = $this->seedCategories((string) $company->company_id);
            $brands = $this->seedBrands((string) $company->company_id);
            $units = $this->seedUnits((string) $company->company_id);
            $warehouses = $this->seedWarehouses((string) $company->company_id);
            $variants = $this->seedVariants((string) $company->company_id);

            $this->seedProducts(
                (string) $company->company_id,
                $categories,
                $brands,
                $units,
                $warehouses,
                $variants
            );
        });

        $this->command?->info('mstore.ecommerce.com ecommerce data seeded successfully.');
    }

    private function seedCategories(string $companyId): array
    {
        $names = [
            "Women's Fashion",
            "Men's Fashion",
            'Kids Wear',
            'Footwear',
            'Bags & Accessories',
            'Beauty & Care',
            'Home Decor',
            'Kitchen Essentials',
            'Electronics',
            'Grocery & Pantry',
        ];

        $records = [];

        foreach ($names as $index => $name) {
            $category = Category::query()->firstOrNew([
                'company_id' => $companyId,
                'title' => $name,
            ]);
            $category->company_id = $companyId;
            $category->title = $name;
            $category->slug = Str::slug($name);
            $category->status = 1;
            $category->show_home = 1;
            $category->short_number = $index + 1;
            $category->is_show_in_category_header = true;
            $category->is_demo = false;
            $category->save();

            $records[$name] = $category;
        }

        return $records;
    }

    private function seedBrands(string $companyId): array
    {
        $names = [
            'Luma Wear',
            'Urban Thread',
            'Little Nest',
            'StepUp',
            'CarryCraft',
            'Glow & Co',
            'Nook Living',
            'Cookwise',
            'NovaTech',
            'FreshRoot',
        ];

        $records = [];

        foreach ($names as $name) {
            $brand = Brand::query()->firstOrNew([
                'company_id' => $companyId,
                'title' => $name,
            ]);
            $brand->company_id = $companyId;
            $brand->title = $name;
            $brand->slug = Str::slug($name);
            $brand->status = 1;
            $brand->is_demo = false;
            $brand->save();

            $records[$name] = $brand;
        }

        return $records;
    }

    private function seedUnits(string $companyId): array
    {
        $items = [
            ['code' => 'PCS', 'name' => 'Piece'],
            ['code' => 'PAIR', 'name' => 'Pair'],
            ['code' => 'SET', 'name' => 'Set'],
            ['code' => 'PACK', 'name' => 'Pack'],
            ['code' => 'BOX', 'name' => 'Box'],
            ['code' => 'KG', 'name' => 'Kilogram'],
            ['code' => 'G', 'name' => 'Gram'],
            ['code' => 'ML', 'name' => 'Milliliter'],
            ['code' => 'L', 'name' => 'Liter'],
            ['code' => 'DOZEN', 'name' => 'Dozen'],
        ];

        $records = [];

        foreach ($items as $item) {
            $unit = Unit::query()->firstOrNew([
                'company_id' => $companyId,
                'unit_code' => $item['code'],
            ]);
            $unit->company_id = $companyId;
            $unit->unit_code = $item['code'];
            $unit->unit_name = $item['name'];
            $unit->base_unit = 0;
            $unit->operator = '*';
            $unit->operation_value = 1;
            $unit->is_active = 1;
            $unit->is_demo = false;
            $unit->save();

            $records[$item['code']] = $unit;
        }

        return $records;
    }

    private function seedWarehouses(string $companyId): array
    {
        $items = [
            ['name' => 'Main Fulfillment Center', 'location' => 'Dhaka', 'is_default' => 1],
            ['name' => 'Dhaka Showroom', 'location' => 'Dhanmondi, Dhaka', 'is_default' => 0],
            ['name' => 'Backup Warehouse', 'location' => 'Gazipur', 'is_default' => 0],
        ];

        $records = [];

        foreach ($items as $item) {
            $warehouse = Warehouse::query()->firstOrNew([
                'company_id' => $companyId,
                'name' => $item['name'],
            ]);
            $warehouse->company_id = $companyId;
            $warehouse->name = $item['name'];
            $warehouse->location = $item['location'];
            $warehouse->is_default = $item['is_default'];
            $warehouse->save();

            $records[$item['name']] = $warehouse;
        }

        return $records;
    }

    private function seedVariants(string $companyId): array
    {
        $items = [
            'Color' => ['Black', 'White', 'Navy', 'Rose'],
            'Size' => ['S', 'M', 'L', 'XL'],
            'Material' => ['Cotton', 'Leather', 'Stainless Steel', 'Bamboo'],
            'Storage' => ['64 GB', '128 GB', '256 GB'],
        ];

        $records = [];

        foreach ($items as $name => $attributes) {
            $variant = ProductVariant::query()->firstOrNew([
                'company_id' => $companyId,
                'name' => $name,
            ]);
            $variant->company_id = $companyId;
            $variant->name = $name;
            $variant->status = 1;
            $variant->is_demo = false;
            $variant->save();

            foreach ($attributes as $attributeValue) {
                $attribute = VariantAttribute::query()->firstOrNew([
                    'company_id' => $companyId,
                    'product_variant_id' => $variant->id,
                    'attribute_value' => $attributeValue,
                ]);
                $attribute->company_id = $companyId;
                $attribute->product_variant_id = $variant->id;
                $attribute->attribute_value = $attributeValue;
                $attribute->is_demo = false;
                $attribute->save();
            }

            $records[$name] = $variant;
        }

        return $records;
    }

    private function seedProducts(
        string $companyId,
        array $categories,
        array $brands,
        array $units,
        array $warehouses,
        array $variants
    ): void {
        $mainWarehouse = $warehouses['Main Fulfillment Center'];

        $items = [
            [
                'code' => 'MSTORE-WOMEN-001',
                'name' => 'Everyday Cotton Kurti',
                'category' => "Women's Fashion",
                'brand' => 'Luma Wear',
                'unit' => 'PCS',
                'price' => 1290,
                'purchase_price' => 720,
                'quantity' => 48,
                'demand_tags' => ['best_seller', 'trending', 'seasonal'],
                'variant_options' => [['Color' => 'Rose', 'Size' => 'M'], ['Color' => 'Navy', 'Size' => 'L']],
            ],
            [
                'code' => 'MSTORE-MEN-001',
                'name' => 'Classic Oxford Shirt',
                'category' => "Men's Fashion",
                'brand' => 'Urban Thread',
                'unit' => 'PCS',
                'price' => 1590,
                'purchase_price' => 880,
                'quantity' => 42,
                'demand_tags' => ['popular', 'most_sold'],
                'variant_options' => [['Color' => 'White', 'Size' => 'M'], ['Color' => 'Black', 'Size' => 'L']],
            ],
            [
                'code' => 'MSTORE-KIDS-001',
                'name' => 'Playtime Hoodie Set',
                'category' => 'Kids Wear',
                'brand' => 'Little Nest',
                'unit' => 'SET',
                'price' => 1190,
                'purchase_price' => 650,
                'quantity' => 36,
                'demand_tags' => ['trending', 'popular'],
                'variant_options' => [['Color' => 'Rose', 'Size' => 'S'], ['Color' => 'Navy', 'Size' => 'M']],
            ],
            [
                'code' => 'MSTORE-FOOT-001',
                'name' => 'Comfort Runner Sneakers',
                'category' => 'Footwear',
                'brand' => 'StepUp',
                'unit' => 'PAIR',
                'price' => 2490,
                'purchase_price' => 1420,
                'quantity' => 28,
                'demand_tags' => ['best_seller', 'top_rated'],
                'variant_options' => [['Color' => 'Black', 'Size' => 'L'], ['Color' => 'White', 'Size' => 'XL']],
            ],
            [
                'code' => 'MSTORE-BAG-001',
                'name' => 'Structured Daily Tote',
                'category' => 'Bags & Accessories',
                'brand' => 'CarryCraft',
                'unit' => 'PCS',
                'price' => 1890,
                'purchase_price' => 1010,
                'quantity' => 25,
                'demand_tags' => ['most_viewed', 'seasonal'],
                'variant_options' => [['Color' => 'Black', 'Material' => 'Leather'], ['Color' => 'Rose', 'Material' => 'Cotton']],
            ],
            [
                'code' => 'MSTORE-BEAUTY-001',
                'name' => 'Hydrating Glow Serum',
                'category' => 'Beauty & Care',
                'brand' => 'Glow & Co',
                'unit' => 'ML',
                'price' => 990,
                'purchase_price' => 510,
                'quantity' => 60,
                'demand_tags' => ['top_rated', 'trending'],
                'variant_options' => [['Material' => 'Bamboo'], ['Material' => 'Cotton']],
            ],
            [
                'code' => 'MSTORE-HOME-001',
                'name' => 'Minimal Table Lamp',
                'category' => 'Home Decor',
                'brand' => 'Nook Living',
                'unit' => 'PCS',
                'price' => 2190,
                'purchase_price' => 1240,
                'quantity' => 18,
                'demand_tags' => ['popular', 'imported'],
                'variant_options' => [['Color' => 'White', 'Material' => 'Bamboo'], ['Color' => 'Black', 'Material' => 'Stainless Steel']],
            ],
            [
                'code' => 'MSTORE-KITCHEN-001',
                'name' => 'Stainless Cookware Set',
                'category' => 'Kitchen Essentials',
                'brand' => 'Cookwise',
                'unit' => 'SET',
                'price' => 3290,
                'purchase_price' => 1940,
                'quantity' => 14,
                'demand_tags' => ['best_seller', 'most_sold'],
                'variant_options' => [['Material' => 'Stainless Steel'], ['Material' => 'Bamboo']],
            ],
            [
                'code' => 'MSTORE-ELECTRONICS-001',
                'name' => '128 GB Smart Tablet',
                'category' => 'Electronics',
                'brand' => 'NovaTech',
                'unit' => 'PCS',
                'price' => 18990,
                'purchase_price' => 15100,
                'quantity' => 12,
                'demand_tags' => ['most_viewed', 'trending'],
                'variant_options' => [['Storage' => '64 GB', 'Color' => 'Black'], ['Storage' => '128 GB', 'Color' => 'White']],
            ],
            [
                'code' => 'MSTORE-GROCERY-001',
                'name' => 'Organic Pantry Starter Box',
                'category' => 'Grocery & Pantry',
                'brand' => 'FreshRoot',
                'unit' => 'BOX',
                'price' => 1490,
                'purchase_price' => 980,
                'quantity' => 32,
                'demand_tags' => ['popular', 'most_sold'],
                'variant_options' => [['Material' => 'Bamboo'], ['Material' => 'Cotton']],
            ],
        ];

        foreach ($items as $index => $item) {
            $category = $categories[$item['category']];
            $brand = $brands[$item['brand']];
            $unit = $units[$item['unit']];

            $product = Product::query()->firstOrNew([
                'company_id' => $companyId,
                'code' => $item['code'],
            ]);
            $product->company_id = $companyId;
            $product->code = $item['code'];
            $product->name = $item['name'];
            $product->slug = Str::slug($item['code'].'-'.$item['brand'].'-'.$item['name']);
            $product->brand_id = $brand->id;
            $product->category_id = $category->id;
            $product->unit_id = $unit->id;
            $product->thumbnail = null;
            $product->featured_image = null;
            $product->images = json_encode([]);
            $product->status = 1;
            $product->description = $item['name'].' from '.$item['brand'].' at mstore.ecommerce.com.';
            $product->shipping_information = 'Ships within 1 to 2 business days.';
            $product->return_information = '7-day return available for unused items.';
            $product->return_policy = 'Standard mstore return policy applies.';
            $product->is_free = false;
            $product->meta_title = $item['name'].' | mstore';
            $product->meta_tags = json_encode([$item['code'], $item['category'], $item['brand']]);
            $product->meta_descriptions = 'Shop '.$item['name'].' from '.$item['brand'].' at mstore.ecommerce.com.';
            $product->has_variant = true;
            $product->has_segment = false;
            $product->variants = $item['variant_options'];
            $product->segmentation = [];
            $product->vat = 5;
            $product->sales_channel = ['online_store'];
            $product->demand_tags = $item['demand_tags'];
            $product->stock_visibility = true;
            $product->stock_visibility_label = null;
            $product->is_demo = false;
            $product->is_featured = $index < 4;
            $product->is_bundle = false;
            $product->bundle_uuid = null;
            $product->is_group_purchase_available = false;
            $product->group_purchase_discount_type = null;
            $product->group_purchase_minimum_user = null;
            $product->group_purchase_discount_amount = null;
            if (empty($product->id)) {
                $product->id = substr(uniqid(), 0, 13).'-prod-'.random_int(10000000000000000, 99999999999999999);
            }
            $product->saveQuietly();

            $inventory = Inventory::withTrashed()->firstOrNew([
                'company_id' => $companyId,
                'warehouse_id' => $mainWarehouse->id,
                'product_id' => $product->id,
            ]);
            $inventory->company_id = $companyId;
            $inventory->warehouse_id = $mainWarehouse->id;
            $inventory->product_id = $product->id;
            $inventory->quantity = $item['quantity'];
            $inventory->alert_quantity = 5;
            $inventory->stock_out_mood = 'FIFO';
            if ($inventory->trashed()) {
                $inventory->restore();
            }
            $inventory->save();

            $inventoryItem = InventoryItem::withTrashed()->firstOrNew([
                'company_id' => $companyId,
                'inventory_id' => $inventory->id,
                'warehouse_id' => $mainWarehouse->id,
                'product_id' => $product->id,
            ]);
            $inventoryItem->company_id = $companyId;
            $inventoryItem->inventory_id = $inventory->id;
            $inventoryItem->warehouse_id = $mainWarehouse->id;
            $inventoryItem->product_id = $product->id;
            $inventoryItem->barcode = $item['code'];
            $inventoryItem->sku = $item['code'];
            $inventoryItem->quantity = $item['quantity'];
            $inventoryItem->variant_id = null;
            $inventoryItem->segmentations = null;
            $inventoryItem->price = $item['price'];
            $inventoryItem->purchase_price = $item['purchase_price'];
            $inventoryItem->price_json = null;
            $inventoryItem->stock_out_mood = 'FIFO';
            $inventoryItem->discount_amount = 0;
            $inventoryItem->discount_type = null;
            $inventoryItem->alert_quantity = 5;
            if ($inventoryItem->trashed()) {
                $inventoryItem->restore();
            }
            $inventoryItem->save();
        }
    }
}
