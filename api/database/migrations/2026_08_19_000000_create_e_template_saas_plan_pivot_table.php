<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e_template_saas_plan', function (Blueprint $table) {
            $table->id();
            $table->foreignId('template_id')->constrained('e_templates')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('saas_plans')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['template_id', 'plan_id']);
        });

        if (Schema::hasTable('e_templates') && Schema::hasColumn('e_templates', 'saas_plan_id')) {
            $timestamp = now();
            $rows = DB::table('e_templates')
                ->whereNotNull('saas_plan_id')
                ->get(['id', 'saas_plan_id']);

            if ($rows->isNotEmpty()) {
                DB::table('e_template_saas_plan')->insert(
                    $rows->map(function ($row) use ($timestamp) {
                        return [
                            'template_id' => (int) $row->id,
                            'plan_id' => (int) $row->saas_plan_id,
                            'created_at' => $timestamp,
                            'updated_at' => $timestamp,
                        ];
                    })->all()
                );
            }

            Schema::table('e_templates', function (Blueprint $table) {
                if (Schema::hasColumn('e_templates', 'saas_plan_id')) {
                    $table->dropConstrainedForeignId('saas_plan_id');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('e_templates') && ! Schema::hasColumn('e_templates', 'saas_plan_id')) {
            Schema::table('e_templates', function (Blueprint $table) {
                $table->foreignId('saas_plan_id')
                    ->nullable()
                    ->after('price')
                    ->constrained('saas_plans')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('e_template_saas_plan')) {
            $rows = DB::table('e_template_saas_plan')
                ->orderBy('created_at')
                ->get(['template_id', 'plan_id']);

            if ($rows->isNotEmpty()) {
                $firstPlanPerTemplate = $rows
                    ->groupBy('template_id')
                    ->map(fn ($items) => (int) $items->first()->plan_id);

                foreach ($firstPlanPerTemplate as $templateId => $planId) {
                    DB::table('e_templates')
                        ->where('id', (int) $templateId)
                        ->update(['saas_plan_id' => $planId]);
                }
            }

            Schema::dropIfExists('e_template_saas_plan');
        }
    }
};
