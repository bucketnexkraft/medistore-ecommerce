<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['storefront_sections', 'e_template_sections'] as $table) {
            if (! Schema::hasColumn($table, 'config_json')) {
                continue;
            }

            DB::table($table)
                ->whereNotNull('config_json')
                ->select(['id', 'config_json'])
                ->orderBy('id')
                ->get()
                ->each(function (object $row) use ($table): void {
                    $value = $row->config_json;

                    // Legacy saves could encode the JSON before the model cast,
                    // leaving a JSON string inside the JSON column.
                    for ($attempt = 0; $attempt < 2 && is_string($value); $attempt++) {
                        $decoded = json_decode($value, true);
                        $value = json_last_error() === JSON_ERROR_NONE ? $decoded : null;
                    }

                    if (! is_array($value)) {
                        return;
                    }

                    $raw = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

                    if ($raw !== false && $raw !== $row->config_json) {
                        DB::table($table)
                            ->where('id', $row->id)
                            ->update(['config_json' => $raw]);
                    }
                });
        }
    }

    public function down(): void
    {
        // The migration only removes an encoding defect; there is no safe
        // reverse operation because the canonical JSON should be preserved.
    }
};
