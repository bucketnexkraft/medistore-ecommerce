<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payout_requests', function (Blueprint $table) {
            $table->string('request_type', 32)->default('customer')->after('user_id')->index();
            $table->string('payout_method', 64)->nullable()->after('amount');
            $table->json('payout_details')->nullable()->after('payout_method');
        });
    }

    public function down(): void
    {
        Schema::table('payout_requests', function (Blueprint $table) {
            $table->dropIndex(['request_type']);
            $table->dropColumn(['request_type', 'payout_method', 'payout_details']);
        });
    }
};
