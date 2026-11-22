<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (!Schema::hasColumn('company', 'social_auth_enabled')) {
                $table->boolean('social_auth_enabled')->default(false)->after('google_client_secret');
            }
        });

        if (Schema::hasTable('company_feature_preference')) {
            $enabledCompanyIds = DB::table('company_feature_preference')
                ->whereIn('feature', ['ftr_social_auth', 'SOCIAL_AUTH'])
                ->where('active', 1)
                ->pluck('company_id');

            if ($enabledCompanyIds->isNotEmpty()) {
                DB::table('company')
                    ->whereIn('company_id', $enabledCompanyIds->all())
                    ->update(['social_auth_enabled' => true]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (Schema::hasColumn('company', 'social_auth_enabled')) {
                $table->dropColumn('social_auth_enabled');
            }
        });
    }
};
