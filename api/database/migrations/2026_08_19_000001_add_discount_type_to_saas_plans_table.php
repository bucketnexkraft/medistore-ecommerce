<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('saas_plans', 'discount_type')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->enum('discount_type', ['fixed', 'percent'])
                    ->default('fixed')
                    ->after('discount_amount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('saas_plans', 'discount_type')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->dropColumn('discount_type');
            });
        }
    }
};
