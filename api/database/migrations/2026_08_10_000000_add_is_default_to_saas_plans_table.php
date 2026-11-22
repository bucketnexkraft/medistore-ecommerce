<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('saas_plans', 'is_default')) {
                $table->boolean('is_default')->default(false)->after('status')->index();
            }
        });

        $fallbackId = DB::table('saas_plans')
            ->orderByDesc('status')
            ->orderBy('id')
            ->value('id');

        if ($fallbackId) {
            DB::table('saas_plans')->update(['is_default' => false]);
            DB::table('saas_plans')
                ->where('id', $fallbackId)
                ->update(['is_default' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('saas_plans', function (Blueprint $table) {
            if (Schema::hasColumn('saas_plans', 'is_default')) {
                $table->dropColumn('is_default');
            }
        });
    }
};
