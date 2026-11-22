<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user', function (Blueprint $table) {
            if (! Schema::hasColumn('user', 'wallet_balance')) {
                $table->decimal('wallet_balance', 15, 2)->default(0)->after('company_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('user', function (Blueprint $table) {
            if (Schema::hasColumn('user', 'wallet_balance')) {
                $table->dropColumn('wallet_balance');
            }
        });
    }
};
