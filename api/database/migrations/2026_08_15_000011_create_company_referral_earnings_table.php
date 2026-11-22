<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('company_referral_earnings')) {
            Schema::create('company_referral_earnings', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->string('company_id', 100)->index();
                $table->string('source_company_id', 100)->index();
                $table->unsignedBigInteger('plan_payment_log_id')->nullable()->index();
                $table->string('reference_key', 255)->unique();
                $table->unsignedTinyInteger('level')->default(1);
                $table->string('reward_type', 32)->default('plan');
                $table->decimal('amount', 15, 2)->default(0);
                $table->string('status', 24)->default('credited');
                $table->text('notes')->nullable();
                $table->timestamp('credited_at')->nullable();
                $table->timestamps();

                $table->index(['company_id', 'reward_type']);
                $table->index(['source_company_id', 'reward_type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('company_referral_earnings');
    }
};
