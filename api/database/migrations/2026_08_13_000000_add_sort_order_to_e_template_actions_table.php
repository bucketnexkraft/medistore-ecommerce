<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_template_actions', function (Blueprint $table) {
            if (! Schema::hasColumn('e_template_actions', 'sort_order')) {
                $table->unsignedInteger('sort_order')->default(1)->after('footer_group');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_template_actions', function (Blueprint $table) {
            if (Schema::hasColumn('e_template_actions', 'sort_order')) {
                $table->dropColumn('sort_order');
            }
        });
    }
};
