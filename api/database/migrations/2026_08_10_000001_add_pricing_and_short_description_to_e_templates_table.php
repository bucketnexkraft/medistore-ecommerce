<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (!Schema::hasColumn('e_templates', 'short_description')) {
                $table->string('short_description', 500)->nullable()->after('template_name');
            }

            if (!Schema::hasColumn('e_templates', 'price')) {
                $table->decimal('price', 10, 2)->default(0)->after('short_description');
            }
        });
    }

    public function down(): void
    {
        Schema::table('e_templates', function (Blueprint $table) {
            if (Schema::hasColumn('e_templates', 'price')) {
                $table->dropColumn('price');
            }

            if (Schema::hasColumn('e_templates', 'short_description')) {
                $table->dropColumn('short_description');
            }
        });
    }
};
