<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('ai_usage_logs')) {
            return;
        }

        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->string('company_id', 36)->index();
            $table->string('user_id', 36)->nullable()->index();
            $table->longText('feature_key')->default('product_description')->index();
            $table->unsignedInteger('characters_generated')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'feature_key', 'created_at'], 'ai_usage_logs_company_feature_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
