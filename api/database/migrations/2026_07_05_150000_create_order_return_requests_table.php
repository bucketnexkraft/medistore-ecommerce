<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_return_requests', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('order_id', 80)->index();
            $table->unsignedBigInteger('order_item_id')->index();
            $table->string('company_id', 40)->nullable()->index();
            $table->string('user_id', 40)->index();
            $table->string('product_id', 100)->nullable()->index();
            $table->text('reason');
            $table->string('status', 40)->default('pending')->index();
            $table->decimal('refund_amount', 15, 2)->default(0);
            $table->string('approved_by', 40)->nullable()->index();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(['order_id', 'order_item_id'], 'order_return_requests_order_item_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_return_requests');
    }
};
