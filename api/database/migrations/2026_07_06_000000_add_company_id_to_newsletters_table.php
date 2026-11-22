<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('newsletters')) {
            return;
        }

        Schema::table('newsletters', function (Blueprint $table) {
            if (! Schema::hasColumn('newsletters', 'company_id')) {
                $table->string('company_id')->nullable()->after('id')->index();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('newsletters') || ! Schema::hasColumn('newsletters', 'company_id')) {
            return;
        }

        Schema::table('newsletters', function (Blueprint $table) {
            $table->dropIndex(['company_id']);
            $table->dropColumn('company_id');
        });
    }
};
