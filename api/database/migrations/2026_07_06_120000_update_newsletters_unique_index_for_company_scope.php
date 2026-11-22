<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('newsletters') || ! Schema::hasColumn('newsletters', 'email')) {
            return;
        }

        $indexes = collect(DB::select("SHOW INDEX FROM newsletters"))
            ->groupBy(fn ($index) => (string) $index->Key_name);

        Schema::table('newsletters', function (Blueprint $table) use ($indexes) {
            if ($indexes->has('newsletters_email_unique')) {
                $table->dropUnique('newsletters_email_unique');
            }
        });

        if (! Schema::hasColumn('newsletters', 'company_id')) {
            return;
        }

        $indexes = collect(DB::select("SHOW INDEX FROM newsletters"))
            ->groupBy(fn ($index) => (string) $index->Key_name);

        Schema::table('newsletters', function (Blueprint $table) use ($indexes) {
            if (! $indexes->has('newsletters_company_id_email_unique')) {
                $table->unique(['company_id', 'email'], 'newsletters_company_id_email_unique');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('newsletters') || ! Schema::hasColumn('newsletters', 'email')) {
            return;
        }

        $indexes = collect(DB::select("SHOW INDEX FROM newsletters"))
            ->groupBy(fn ($index) => (string) $index->Key_name);

        Schema::table('newsletters', function (Blueprint $table) use ($indexes) {
            if ($indexes->has('newsletters_company_id_email_unique')) {
                $table->dropUnique('newsletters_company_id_email_unique');
            }
        });

        $indexes = collect(DB::select("SHOW INDEX FROM newsletters"))
            ->groupBy(fn ($index) => (string) $index->Key_name);

        Schema::table('newsletters', function (Blueprint $table) use ($indexes) {
            if (! $indexes->has('newsletters_email_unique')) {
                $table->unique('email', 'newsletters_email_unique');
            }
        });
    }
};
