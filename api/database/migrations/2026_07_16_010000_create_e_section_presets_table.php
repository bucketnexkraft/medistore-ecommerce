<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e_section_presets', function (Blueprint $table) {
            $table->id();
            $table->string('name', 191);
            $table->string('section_type', 80)->index();
            $table->string('preview_image', 191)->nullable();
            $table->json('categories')->nullable();
            $table->longText('config_json')->nullable();
            $table->boolean('status')->default(true)->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e_section_presets');
    }
};
