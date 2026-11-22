<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $columns = array_filter([
            Schema::hasColumn('saas_plans', 'management_fee') ? 'management_fee' : null,
            Schema::hasColumn('saas_plans', 'management_fee_type') ? 'management_fee_type' : null,
        ]);

        if ($columns) {
            Schema::table('saas_plans', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (! Schema::hasColumn('saas_plans', 'management_fee')) {
                $table->decimal('management_fee', 10, 2)->default(0);
            }

            if (! Schema::hasColumn('saas_plans', 'management_fee_type')) {
                $table->enum('management_fee_type', ['fixed', 'percent'])->default('fixed');
            }
        });
    }
};
