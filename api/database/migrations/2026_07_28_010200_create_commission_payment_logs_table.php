<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commission_payment_logs', function (Blueprint $table) {
            $table->id();
            $table->string('trx', 40)->unique();
            $table->string('company_id', 80)->index();
            $table->unsignedBigInteger('saas_plan_id')->nullable()->index();
            $table->string('user_id', 80)->nullable()->index();
            $table->string('gateway_id', 80)->nullable()->index();
            $table->string('gateway_name', 255)->nullable();
            $table->unsignedBigInteger('currency_id')->nullable()->index();
            $table->decimal('amount', 28, 8)->default(0);
            $table->decimal('gateway_charge', 28, 8)->default(0);
            $table->string('gateway_charge_type', 20)->default('fixed');
            $table->decimal('payable_amount', 28, 8)->default(0);
            $table->string('status', 20)->default('pending')->index();
            $table->json('payment_payload')->nullable();
            $table->text('remarks')->nullable();
            $table->string('gateway_txn_id', 255)->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commission_payment_logs');
    }
};
