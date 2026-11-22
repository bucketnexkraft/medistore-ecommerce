<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (! Schema::hasColumn('e_templates', 'template_type')) {
                $table->string('template_type', 20)->default('paid')->after('template_name');
            }
            if (! Schema::hasColumn('e_templates', 'discount_amount')) {
                $table->decimal('discount_amount', 10, 2)->default(0)->after('price');
            }
            if (! Schema::hasColumn('e_templates', 'discount_type')) {
                $table->string('discount_type', 20)->default('fixed')->after('discount_amount');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            foreach (['discount_type', 'discount_amount', 'template_type'] as $column) {
                if (Schema::hasColumn('e_templates', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
