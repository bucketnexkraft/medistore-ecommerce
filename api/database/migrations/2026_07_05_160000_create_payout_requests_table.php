<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payout_requests', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('company_id')->nullable()->index();
            $table->string('user_id')->index();
            $table->decimal('amount', 12, 2)->default(0);
            $table->text('description');
            $table->string('status')->default('pending')->index();
            $table->string('processed_by')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'payout_requests_company_status_index');
            $table->index(['user_id', 'status'], 'payout_requests_user_status_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payout_requests');
    }
};
