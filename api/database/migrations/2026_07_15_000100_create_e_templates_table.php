<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('e_templates', function (Blueprint $table) {
            $table->id();
            $table->string('template_name', 191);
            $table->string('image', 255)->nullable();
            $table->json('categories')->nullable();
            $table->json('tags')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('e_templates');
    }
};
