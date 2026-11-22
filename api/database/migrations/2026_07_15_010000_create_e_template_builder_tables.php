<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e_template_pages', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->foreignId('template_id')->constrained('e_templates')->cascadeOnDelete();
            $table->string('name', 191);
            $table->string('slug', 160);
            $table->string('route_mode', 40)->default('custom_url');
            $table->string('route_key', 160)->nullable();
            $table->text('description')->nullable();
            $table->string('menu_token', 120)->nullable();
            $table->timestamps();
        });

        Schema::create('e_template_sections', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->foreignId('template_id')->constrained('e_templates')->cascadeOnDelete();
            $table->string('page_id', 80)->index();
            $table->string('name', 191)->nullable();
            $table->string('title', 191)->nullable();
            $table->text('subtitle')->nullable();
            $table->string('layout', 50)->default('template');
            $table->string('variant', 80)->nullable();
            $table->string('preset_key', 120)->nullable();
            $table->unsignedInteger('order')->default(1);
            $table->longText('query_sql')->nullable();
            $table->longText('query_json')->nullable();
            $table->longText('rich_text_html')->nullable();
            $table->timestamps();
            $table->foreign('page_id')->references('id')->on('e_template_pages')->cascadeOnDelete();
        });

        Schema::create('e_template_actions', function (Blueprint $table) {
            $table->string('id', 80)->primary();
            $table->foreignId('template_id')->constrained('e_templates')->cascadeOnDelete();
            $table->string('page_id', 80)->index();
            $table->string('section_id', 80)->nullable()->index();
            $table->string('target_page_id', 80)->nullable()->index();
            $table->string('name', 191)->nullable();
            $table->string('slug', 120)->nullable();
            $table->longText('expression')->nullable();
            $table->string('link_type', 40)->nullable();
            $table->string('route_key', 160)->nullable();
            $table->string('label', 191)->nullable();
            $table->string('placement', 50)->default('contextual');
            $table->string('footer_group', 50)->nullable();
            $table->timestamps();
            $table->foreign('page_id')->references('id')->on('e_template_pages')->cascadeOnDelete();
            $table->foreign('section_id')->references('id')->on('e_template_sections')->nullOnDelete();
            $table->foreign('target_page_id')->references('id')->on('e_template_pages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e_template_actions');
        Schema::dropIfExists('e_template_sections');
        Schema::dropIfExists('e_template_pages');
    }
};
