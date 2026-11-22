<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('company_feature_preference', 'is_default_active')) {
            Schema::table('company_feature_preference', function (Blueprint $table) {
                $table->boolean('is_default_active')->nullable()->after('active');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('company_feature_preference', 'is_default_active')) {
            Schema::table('company_feature_preference', function (Blueprint $table) {
                $table->dropColumn('is_default_active');
            });
        }
    }
};
