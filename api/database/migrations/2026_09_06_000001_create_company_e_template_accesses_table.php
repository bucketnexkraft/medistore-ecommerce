<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_e_template_accesses', function (Blueprint $table) {
            $table->id();
            $table->string('company_id')->index();
            $table->foreignId('template_id')->constrained('e_templates')->cascadeOnDelete();
            $table->unsignedBigInteger('plan_payment_log_id')->nullable()->index();
            $table->decimal('amount', 28, 8)->default(0);
            $table->timestamps();

            $table->unique(['company_id', 'template_id']);
        });

        if (Schema::hasTable('company') && Schema::hasColumn('company', 'selected_e_template_id')) {
            $timestamp = now();
            DB::table('company')
                ->whereNotNull('selected_e_template_id')
                ->get(['company_id', 'selected_e_template_id'])
                ->each(function ($company) use ($timestamp) {
                    DB::table('company_e_template_accesses')->insertOrIgnore([
                        'company_id' => (string) $company->company_id,
                        'template_id' => (int) $company->selected_e_template_id,
                        'amount' => 0,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ]);
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('company_e_template_accesses');
    }
};
