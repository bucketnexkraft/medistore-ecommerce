<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('storefront_pages', function (Blueprint $table) {
            $table->string('slug', 160)->nullable()->after('name');
        });

        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->string('target_page_id', 80)->nullable()->after('page_id')->index();
            $table->foreign('target_page_id')->references('id')->on('storefront_pages')->nullOnDelete();
        });

        DB::table('storefront_pages')
            ->orderBy('created_at')
            ->get(['id', 'name'])
            ->each(function ($page, $index) {
                $slug = Str::slug((string) ($page->name ?? '')) ?: ('page-' . ($index + 1));
                DB::table('storefront_pages')
                    ->where('id', $page->id)
                    ->update(['slug' => $slug]);
            });
    }

    public function down(): void
    {
        Schema::table('storefront_actions', function (Blueprint $table) {
            $table->dropForeign(['target_page_id']);
            $table->dropColumn('target_page_id');
        });

        Schema::table('storefront_pages', function (Blueprint $table) {
            $table->dropColumn('slug');
        });
    }
};
