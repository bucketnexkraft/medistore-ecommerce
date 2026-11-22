<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $table->unsignedBigInteger('ecommerce_category_id')->nullable()->after('saas_plan_id');
            $table->foreignId('selected_e_template_id')->nullable()->after('ecommerce_category_id')->constrained('e_templates')->nullOnDelete();
            $table->timestamp('ecommerce_setup_completed_at')->nullable()->after('selected_e_template_id');

            $table->foreign('ecommerce_category_id')->references('id')->on('e_categories')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            $table->dropForeign(['ecommerce_category_id']);
            $table->dropConstrainedForeignId('selected_e_template_id');
            $table->dropColumn(['ecommerce_category_id', 'ecommerce_setup_completed_at']);
        });
    }
};
