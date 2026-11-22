<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company', function (Blueprint $table) {
            if (! Schema::hasColumn('company', 'chat_support_channel')) {
                $table->string('chat_support_channel', 32)->nullable()->after('youtube_link');
            }

            if (! Schema::hasColumn('company', 'facebook_page_id')) {
                $table->string('facebook_page_id')->nullable()->after('chat_support_channel');
            }

            if (! Schema::hasColumn('company', 'whatsapp_number')) {
                $table->string('whatsapp_number')->nullable()->after('facebook_page_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company', function (Blueprint $table) {
            foreach (['chat_support_channel', 'facebook_page_id', 'whatsapp_number'] as $column) {
                if (Schema::hasColumn('company', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
