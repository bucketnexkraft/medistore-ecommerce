<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (! Schema::hasColumn('e_templates', 'saas_plan_id')) {
                $table->foreignId('saas_plan_id')
                    ->nullable()
                    ->after('price')
                    ->constrained('saas_plans')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (Schema::hasColumn('e_templates', 'saas_plan_id')) {
                $table->dropConstrainedForeignId('saas_plan_id');
            }
        });
    }
};
