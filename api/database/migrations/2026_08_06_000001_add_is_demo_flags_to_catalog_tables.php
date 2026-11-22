<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            if (! Schema::hasColumn('categories', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('is_show_in_category_header');
            }
        });

        Schema::table('brand', function (Blueprint $table) {
            if (! Schema::hasColumn('brand', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('status');
            }
        });

        Schema::table('units', function (Blueprint $table) {
            if (! Schema::hasColumn('units', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('is_active');
            }
        });

        Schema::table('product', function (Blueprint $table) {
            if (! Schema::hasColumn('product', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('stock_visibility_label');
            }
        });

        Schema::table('product_variants', function (Blueprint $table) {
            if (! Schema::hasColumn('product_variants', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('status');
            }
        });

        Schema::table('variant_attributes', function (Blueprint $table) {
            if (! Schema::hasColumn('variant_attributes', 'is_demo')) {
                $table->boolean('is_demo')->default(false)->after('product_variant_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('variant_attributes', function (Blueprint $table) {
            if (Schema::hasColumn('variant_attributes', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });

        Schema::table('product_variants', function (Blueprint $table) {
            if (Schema::hasColumn('product_variants', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });

        Schema::table('product', function (Blueprint $table) {
            if (Schema::hasColumn('product', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });

        Schema::table('units', function (Blueprint $table) {
            if (Schema::hasColumn('units', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });

        Schema::table('brand', function (Blueprint $table) {
            if (Schema::hasColumn('brand', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });

        Schema::table('categories', function (Blueprint $table) {
            if (Schema::hasColumn('categories', 'is_demo')) {
                $table->dropColumn('is_demo');
            }
        });
    }
};
