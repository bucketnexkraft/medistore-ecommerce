<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 80)->index();
            $table->string('company_id', 40)->nullable()->index();
            $table->string('product_id', 100)->index();
            $table->unsignedBigInteger('inventory_id')->nullable()->index();
            $table->unsignedBigInteger('inventory_item_id')->nullable()->index();
            $table->string('product_name', 255);
            $table->string('product_slug', 255)->nullable();
            $table->text('product_image')->nullable();
            $table->string('brand_name', 255)->nullable();
            $table->string('category_name', 255)->nullable();
            $table->decimal('quantity', 15, 2);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('tax_rate', 8, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
    }
};
