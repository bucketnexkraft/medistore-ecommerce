<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_shipping')) {
            return;
        }

        Schema::table('user_shipping', function (Blueprint $table) {
            if (! Schema::hasColumn('user_shipping', 'division_name')) {
                $table->string('division_name', 120)->nullable()->after('address');
            }

            if (! Schema::hasColumn('user_shipping', 'district_name')) {
                $table->string('district_name', 120)->nullable()->after('division_name');
            }

            if (! Schema::hasColumn('user_shipping', 'upazila_name')) {
                $table->string('upazila_name', 120)->nullable()->after('district_name');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('user_shipping')) {
            return;
        }

        Schema::table('user_shipping', function (Blueprint $table) {
            foreach (['upazila_name', 'district_name', 'division_name'] as $column) {
                if (Schema::hasColumn('user_shipping', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
