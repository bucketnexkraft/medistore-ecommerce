<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('saas_plans', 'plan_type')) {
                $table->string('plan_type', 30)->default('paid')->after('is_free');
            }

            if (!Schema::hasColumn('saas_plans', 'commission_rate')) {
                $table->decimal('commission_rate', 12, 4)->default(0)->after('trial_period');
            }

            if (!Schema::hasColumn('saas_plans', 'commission_type')) {
                $table->string('commission_type', 20)->default('percent')->after('commission_rate');
            }

            if (!Schema::hasColumn('saas_plans', 'commission_base')) {
                $table->string('commission_base', 30)->default('total_amount')->after('commission_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            foreach (['plan_type', 'commission_rate', 'commission_type', 'commission_base'] as $column) {
                if (Schema::hasColumn('saas_plans', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
