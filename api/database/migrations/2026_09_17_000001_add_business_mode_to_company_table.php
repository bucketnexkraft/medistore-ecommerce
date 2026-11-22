<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('company', 'business_mode')) {
            Schema::table('company', function (Blueprint $table) {
                $table->string('business_mode', 20)->default('pos')->after('type');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('company', 'business_mode')) {
            Schema::table('company', function (Blueprint $table) {
                $table->dropColumn('business_mode');
            });
        }
    }
};
