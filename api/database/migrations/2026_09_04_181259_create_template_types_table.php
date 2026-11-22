<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('template_types', function (Blueprint $table) {
            $table->uuid('id');
            $table->string('company_id');
            $table->string('name');
            $table->string('description',1024);
            $table->string('discount_type');
            $table->decimal('discount_value',19,2);
            $table->boolean('status');
            $table->string('created_by');
            $table->string('updated_by');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('template_types');
    }
};
