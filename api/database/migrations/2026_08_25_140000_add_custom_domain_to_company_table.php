<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (! Schema::hasColumn('company', 'custom_domain')) {
                $table->string('custom_domain')->nullable()->unique()->after('domain');
            }

            if (! Schema::hasColumn('company', 'custom_domain_verified_at')) {
                $table->timestamp('custom_domain_verified_at')->nullable()->after('custom_domain');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (Schema::hasColumn('company', 'custom_domain_verified_at')) {
                $table->dropColumn('custom_domain_verified_at');
            }

            if (Schema::hasColumn('company', 'custom_domain')) {
                $table->dropUnique(['custom_domain']);
                $table->dropColumn('custom_domain');
            }
        });
    }
};
