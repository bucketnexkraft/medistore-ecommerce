<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_reviews', function (Blueprint $table) {
            $table->id();
            $table->string('order_id', 80)->index();
            $table->string('product_id', 80)->index();
            $table->string('user_id', 40)->index();
            $table->string('company_id', 40)->nullable()->index();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'product_id', 'user_id'], 'product_reviews_unique_order_product_user');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_reviews');
    }
};
