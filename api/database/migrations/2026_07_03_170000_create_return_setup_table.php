<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('return_setup', function (Blueprint $table) {
            $table->id();
            $table->string('company_id', 40)->nullable()->index();
            $table->string('brand_id', 40)->nullable()->index();
            $table->string('product_id', 40)->nullable()->index();
            $table->string('category_id', 40)->nullable()->index();
            $table->boolean('return_enabled')->default(false);
            $table->unsignedInteger('return_day')->default(0);
            $table->json('return_condition')->nullable();
            $table->timestamps();

            $table->index(
                ['company_id', 'brand_id', 'product_id', 'category_id'],
                'return_setup_scope_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('return_setup');
    }
};
