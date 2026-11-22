<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->string('company_id', 40)->index();
            $table->string('event_id', 80);
            $table->string('session_id', 80)->index();
            $table->string('user_id', 40)->nullable()->index();
            $table->string('event_name', 40)->index();
            $table->string('product_id', 100)->nullable()->index();
            $table->string('product_name')->nullable();
            $table->string('order_id', 80)->nullable()->index();
            $table->string('page_path', 500)->nullable();
            $table->string('page_title')->nullable();
            $table->text('referrer')->nullable();
            $table->string('source', 120)->nullable()->index();
            $table->string('medium', 120)->nullable();
            $table->string('campaign', 180)->nullable();
            $table->string('device_type', 30)->nullable();
            $table->string('browser', 60)->nullable();
            $table->string('operating_system', 60)->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->string('currency', 10)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamps();

            $table->unique(['company_id', 'event_id']);
            $table->index(['company_id', 'event_name', 'occurred_at'], 'analytics_company_event_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
