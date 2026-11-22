<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_shipping', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 40)->index();
            $table->string('full_name', 255);
            $table->string('email', 255)->nullable();
            $table->string('phone', 100);
            $table->text('address');
            $table->string('city', 120);
            $table->string('country', 120);
            $table->string('postal_code', 40)->nullable();
            $table->boolean('is_default')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_shipping');
    }
};
