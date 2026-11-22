<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('storefront_pages', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('company_id', 40)->collation('utf8mb4_general_ci')->index();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('menu_token', 120)->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('company_id')->on('company')->cascadeOnDelete();
        });

        Schema::create('storefront_sections', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('company_id', 40)->collation('utf8mb4_general_ci')->index();
            $table->string('page_id', 80)->index();
            $table->string('name');
            $table->string('title')->nullable();
            $table->text('subtitle')->nullable();
            $table->string('layout', 50)->default('template');
            $table->string('variant', 80)->nullable();
            $table->unsignedInteger('order')->default(1);
            $table->longText('query_sql')->nullable();
            $table->longText('query_json')->nullable();
            $table->longText('rich_text_html')->nullable();
            $table->timestamps();

            $table->foreign('company_id')->references('company_id')->on('company')->cascadeOnDelete();
            $table->foreign('page_id')->references('id')->on('storefront_pages')->cascadeOnDelete();
        });

        Schema::create('storefront_actions', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->string('company_id', 40)->collation('utf8mb4_general_ci')->index();
            $table->string('page_id', 80)->index();
            $table->string('section_id', 80)->nullable()->index();
            $table->string('name');
            $table->string('slug', 120);
            $table->longText('expression')->nullable();
            $table->string('label')->nullable();
            $table->string('placement', 50)->default('contextual');
            $table->timestamps();

            $table->foreign('company_id')->references('company_id')->on('company')->cascadeOnDelete();
            $table->foreign('page_id')->references('id')->on('storefront_pages')->cascadeOnDelete();
            $table->foreign('section_id')->references('id')->on('storefront_sections')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('storefront_actions');
        Schema::dropIfExists('storefront_sections');
        Schema::dropIfExists('storefront_pages');
    }
};
