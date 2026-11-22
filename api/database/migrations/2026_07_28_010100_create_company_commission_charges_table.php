<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_commission_charges', function (Blueprint $table) {
            $table->id();
            $table->string('company_id', 80)->index();
            $table->unsignedBigInteger('saas_plan_id')->nullable()->index();
            $table->string('order_id', 80)->index();
            $table->string('order_no', 80)->nullable()->index();
            $table->decimal('base_amount', 28, 8)->default(0);
            $table->decimal('commission_rate', 12, 4)->default(0);
            $table->string('commission_type', 20)->default('percent');
            $table->decimal('commission_amount', 28, 8)->default(0);
            $table->string('status', 20)->default('pending')->index();
            $table->unsignedBigInteger('commission_payment_log_id')->nullable()->index();
            $table->timestamp('charged_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->unique('order_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_commission_charges');
    }
};
