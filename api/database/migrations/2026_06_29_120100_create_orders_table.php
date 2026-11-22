<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('order_no', 40)->unique();
            $table->string('user_id', 40)->index();
            $table->unsignedBigInteger('user_shipping_id')->nullable()->index();
            $table->string('company_id', 40)->nullable()->index();
            $table->string('payment_method', 40)->default('cod');
            $table->string('payment_status', 40)->default('pending');
            $table->string('order_status', 40)->default('processing');
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('shipping_amount', 15, 2)->default(0);
            $table->decimal('total_amount', 15, 2)->default(0);
            $table->timestamp('placed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
