<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('e_category_section_presets')) {
            Schema::create('e_category_section_presets', function (Blueprint $table) {
                $table->id();
                $table->foreignId('category_id')->constrained('e_categories')->cascadeOnDelete();
                $table->foreignId('section_preset_id')->constrained('e_section_presets')->cascadeOnDelete();
                $table->unsignedInteger('sort_order')->nullable();
                $table->timestamps();

                $table->unique(['category_id', 'section_preset_id'], 'e_category_section_presets_unique');
                $table->index('sort_order');
            });
        }

        if (! Schema::hasTable('e_section_presets') || ! Schema::hasTable('e_categories')) {
            return;
        }

        $rows = [];

        DB::table('e_section_presets')
            ->select(['id', 'categories'])
            ->orderBy('id')
            ->chunkById(100, function ($presets) use (&$rows) {
                foreach ($presets as $preset) {
                    $categories = json_decode((string) ($preset->categories ?? '[]'), true);

                    if (! is_array($categories)) {
                        continue;
                    }

                    foreach ($categories as $sortOrder => $category) {
                        $categoryId = is_array($category) ? ($category['id'] ?? null) : null;

                        if (! is_numeric($categoryId)) {
                            continue;
                        }

                        $rows[] = [
                            'category_id' => (int) $categoryId,
                            'section_preset_id' => (int) $preset->id,
                            'sort_order' => $sortOrder + 1,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }
                }
            }, 'id');

        if (! empty($rows)) {
            DB::table('e_category_section_presets')->upsert(
                $rows,
                ['category_id', 'section_preset_id'],
                ['sort_order', 'updated_at']
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('e_category_section_presets');
    }
};
