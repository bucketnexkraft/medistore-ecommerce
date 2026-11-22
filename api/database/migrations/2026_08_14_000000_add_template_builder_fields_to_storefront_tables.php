<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_sections', function (Blueprint $table) {
            if (! Schema::hasColumn('storefront_sections', 'newsletter_title')) {
                $table->string('newsletter_title', 191)->nullable()->after('subtitle');
            }

            if (! Schema::hasColumn('storefront_sections', 'newsletter_text')) {
                $table->text('newsletter_text')->nullable()->after('newsletter_title');
            }
        });

        Schema::table('storefront_actions', function (Blueprint $table) {
            if (! Schema::hasColumn('storefront_actions', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(1)->after('footer_group');
            }
        });
    }

    public function down(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            if (Schema::hasColumn('storefront_actions', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });

        Schema::table('storefront_sections', function (Blueprint $table) {
            if (Schema::hasColumn('storefront_sections', 'newsletter_text')) {
                $table->dropColumn('newsletter_text');
            }

            if (Schema::hasColumn('storefront_sections', 'newsletter_title')) {
                $table->dropColumn('newsletter_title');
            }
        });
    }
};
