<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_hierarchies', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120)->unique();
            $table->string('slug', 150)->unique();
            $table->foreignId('parent_hierarchy_id')->nullable()->constrained('location_hierarchies')->nullOnDelete();
            $table->boolean('status')->default(true);
            $table->timestamps();
        });

        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('name', 160);
            $table->string('slug', 191);
            $table->foreignId('location_hierarchy_id')->constrained('location_hierarchies')->cascadeOnDelete();
            $table->foreignId('parent_id')->nullable()->constrained('locations')->nullOnDelete();
            $table->boolean('status')->default(true);
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->unique(['location_hierarchy_id', 'parent_id', 'slug'], 'locations_hierarchy_parent_slug_unique');
            $table->index(['location_hierarchy_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
        Schema::dropIfExists('location_hierarchies');
    }
};
