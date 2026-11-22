<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $template = DB::table('email_templates')
            ->where('key', 'password_reset')
            ->first();

        if (! $template) {
            return;
        }

        // Only upgrade the original plain seed/default body. Do not replace a
        // design that a super admin has already configured in the back office.
        $body = (string) $template->body;
        if (str_contains(strtolower($body), 'style=') || str_contains(strtolower($body), '<table')) {
            return;
        }

        DB::table('email_templates')
            ->where('key', 'password_reset')
            ->update([
                'name' => 'Password Reset',
                'subject' => 'Password Reset Verification Code',
                'body' => <<<'HTML'
<div style="margin:0;background:#f7f5ff;padding:32px 16px;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6ddff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(84,35,231,.08);">
    <div style="background:#5423e7;padding:28px 32px;">
      <div style="font-size:22px;font-weight:700;color:#ffffff;">Nex-Ecommerce</div>
      <div style="margin-top:8px;font-size:13px;color:#e9ddff;">Password security verification</div>
    </div>
    <div style="padding:36px 32px 30px;">
      <p style="margin:0;font-size:15px;color:#667085;">Hello %name%,</p>
      <h1 style="margin:12px 0 14px;font-size:28px;line-height:1.2;color:#172033;">Reset your password</h1>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#667085;">Use the verification code below to continue resetting your Nex-Ecommerce account password.</p>
      <div style="margin:28px 0 24px;padding:20px;background:#faf9ff;border:1px solid #eee9ff;border-radius:12px;text-align:center;">
        <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#7f00ff;text-transform:uppercase;">Verification code</div>
        <div style="margin-top:10px;font-size:34px;line-height:1.2;font-weight:700;letter-spacing:7px;color:#172033;">%otp%</div>
        <div style="margin-top:10px;font-size:13px;color:#98a2b3;">This code expires in %expiry_minutes% minutes.</div>
      </div>
      <p style="margin:0;font-size:13px;line-height:1.7;color:#98a2b3;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    <div style="border-top:1px solid #f0edf7;padding:18px 32px;text-align:center;font-size:12px;color:#98a2b3;">Nex-Ecommerce · Account security notification</div>
  </div>
</div>
HTML,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('email_templates')
            ->where('key', 'password_reset')
            ->update([
                'subject' => 'Password Reset Request',
                'body' => '<p>Dear %name%,</p><p>You requested a password reset. Use this code: %otp%</p>',
                'updated_at' => now(),
            ]);
    }
};
