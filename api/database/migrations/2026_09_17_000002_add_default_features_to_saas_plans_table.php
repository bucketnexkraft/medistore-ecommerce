<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('saas_plans', 'default_features')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->json('default_features')->nullable()->after('features');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('saas_plans', 'default_features')) {
            Schema::table('saas_plans', function (Blueprint $table) {
                $table->dropColumn('default_features');
            });
        }
    }
};
