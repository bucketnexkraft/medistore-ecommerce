<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $template = DB::table('email_templates')
            ->where('key', 'welcome_email')
            ->first();

        if (! $template) {
            return;
        }

        $body = str_replace(
            [
                '>e-Nex</div>',
                'Your business, beautifully managed',
                '© e-Nex · Built for growing businesses',
            ],
            [
                '>%company_name%</div>',
                'Your store account is ready',
                '%company_name% · Store account notification',
            ],
            (string) $template->body,
        );

        DB::table('email_templates')
            ->where('key', 'welcome_email')
            ->update([
                'body' => $body,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Keep the store-specific branding in place when rolling back.
    }
};
