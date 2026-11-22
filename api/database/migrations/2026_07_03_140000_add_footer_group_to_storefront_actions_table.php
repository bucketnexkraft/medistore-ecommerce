<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->string('footer_group', 50)->nullable()->after('placement');
        });
    }

    public function down(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->dropColumn('footer_group');
        });
    }
};
