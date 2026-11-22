<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('saas_plans', 'included_plan_id')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->foreignId('included_plan_id')
                    ->nullable()
                    ->after('plan_type')
                    ->constrained('saas_plans')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('saas_plans', 'included_plan_id')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->dropForeign(['included_plan_id']);
                $table->dropColumn('included_plan_id');
            });
        }
    }
};
