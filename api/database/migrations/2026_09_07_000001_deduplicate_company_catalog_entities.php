<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->deduplicateCategories();
        $this->deduplicateBrands();
        $this->deduplicateUnits();
    }

    public function down(): void
    {
        // Data consolidation migrations are intentionally not reversible.
    }

    private function deduplicateCategories(): void
    {
        $groups = $this->groupCompanyRows('categories', 'title');

        foreach ($groups as $companyId => $rowsByName) {
            foreach ($rowsByName as $rows) {
                $keeperId = array_shift($rows);

                foreach ($rows as $duplicateId) {
                    if (Schema::hasTable('product')) {
                        DB::table('product')
                            ->where('company_id', $companyId)
                            ->where('category_id', $duplicateId)
                            ->update(['category_id' => $keeperId]);
                    }

                    if (Schema::hasTable('categories')) {
                        DB::table('categories')
                            ->where('company_id', $companyId)
                            ->where('ancestor_id', $duplicateId)
                            ->update(['ancestor_id' => $keeperId]);
                    }

                    if (Schema::hasTable('return_setup')) {
                        DB::table('return_setup')
                            ->where('company_id', $companyId)
                            ->where('category_id', $duplicateId)
                            ->update(['category_id' => $keeperId]);
                    }

                    $this->deleteTranslations('App\\Models\\Category', $duplicateId);

                    DB::table('categories')
                        ->where('company_id', $companyId)
                        ->where('id', $duplicateId)
                        ->delete();
                }
            }
        }
    }

    private function deduplicateBrands(): void
    {
        $groups = $this->groupCompanyRows('brand', 'title');

        foreach ($groups as $companyId => $rowsByName) {
            foreach ($rowsByName as $rows) {
                $keeperId = array_shift($rows);

                foreach ($rows as $duplicateId) {
                    if (Schema::hasTable('product')) {
                        DB::table('product')
                            ->where('company_id', $companyId)
                            ->where('brand_id', $duplicateId)
                            ->update(['brand_id' => $keeperId]);
                    }

                    if (Schema::hasTable('return_setup')) {
                        DB::table('return_setup')
                            ->where('company_id', $companyId)
                            ->where('brand_id', $duplicateId)
                            ->update(['brand_id' => $keeperId]);
                    }

                    $this->deleteTranslations('App\\Models\\Brand', $duplicateId);

                    DB::table('brand')
                        ->where('company_id', $companyId)
                        ->where('id', $duplicateId)
                        ->delete();
                }
            }
        }
    }

    private function deduplicateUnits(): void
    {
        $groups = $this->groupCompanyRows('units', 'unit_code');

        foreach ($groups as $companyId => $rowsByCode) {
            foreach ($rowsByCode as $rows) {
                $keeperId = array_shift($rows);

                foreach ($rows as $duplicateId) {
                    if (Schema::hasTable('product')) {
                        DB::table('product')
                            ->where('company_id', $companyId)
                            ->where('unit_id', $duplicateId)
                            ->update(['unit_id' => $keeperId]);
                    }

                    DB::table('units')
                        ->where('company_id', $companyId)
                        ->where('id', $duplicateId)
                        ->delete();
                }
            }
        }
    }

    private function groupCompanyRows(string $table, string $nameColumn): array
    {
        $groups = [];

        DB::table($table)
            ->select(['id', 'company_id', $nameColumn])
            ->whereNotNull('company_id')
            ->where('company_id', '<>', '')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get()
            ->each(function ($row) use (&$groups, $nameColumn): void {
                $companyId = (string) $row->company_id;
                $normalizedName = mb_strtolower(trim((string) $row->{$nameColumn}));

                if ($normalizedName === '') {
                    return;
                }

                $groups[$companyId][$normalizedName][] = (string) $row->id;
            });

        return $groups;
    }

    private function deleteTranslations(string $translatableType, string $translatableId): void
    {
        if (! Schema::hasTable('translations')) {
            return;
        }

        DB::table('translations')
            ->where('translatable_type', $translatableType)
            ->where('translatable_id', $translatableId)
            ->delete();
    }
};
