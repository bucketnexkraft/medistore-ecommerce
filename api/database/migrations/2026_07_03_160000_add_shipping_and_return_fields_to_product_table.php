<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product', function (Blueprint $table) {
            $table->longText('shipping_information')->nullable()->after('description');
            $table->longText('return_information')->nullable()->after('shipping_information');
            $table->longText('return_policy')->nullable()->after('return_information');
        });
    }

    public function down(): void
    {
        Schema::table('product', function (Blueprint $table) {
            $table->dropColumn(['shipping_information', 'return_information', 'return_policy']);
        });
    }
};
