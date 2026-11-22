<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('email_templates')
            ->where('key', 'welcome_email')
            ->update([
                'name' => 'Welcome Email',
                'subject' => 'Your %company_name% store is ready',
                'body' => <<<'HTML'
<div style="margin:0;background:#f7f5ff;padding:32px 16px;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6ddff;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(84,35,231,.08);">
    <div style="background:#5423e7;padding:28px 32px;">
      <div style="font-size:22px;font-weight:700;letter-spacing:-.3px;color:#ffffff;">%company_name%</div>
      <div style="margin-top:8px;font-size:13px;color:#e9ddff;">Your store account is ready</div>
    </div>
    <div style="padding:36px 32px 30px;">
      <p style="margin:0;font-size:15px;color:#667085;">Hello %name%,</p>
      <h1 style="margin:12px 0 14px;font-size:28px;line-height:1.2;color:#172033;">Welcome to %company_name%</h1>
      <p style="margin:0;font-size:16px;line-height:1.7;color:#667085;">Your store account has been created successfully. You can now sign in and start setting up your online business.</p>
      <div style="margin:28px 0 24px;padding:18px 20px;background:#faf9ff;border:1px solid #eee9ff;border-radius:12px;">
        <div style="font-size:13px;color:#98a2b3;">Account details</div>
        <div style="margin-top:10px;font-size:14px;line-height:1.9;color:#344054;"><strong>Email:</strong> %email%<br><strong>Phone:</strong> %phone%</div>
      </div>
      <a href="%login_url%" style="display:inline-block;background:#7f00ff;color:#ffffff;text-decoration:none;border-radius:10px;padding:14px 22px;font-size:15px;font-weight:700;">Open your dashboard&nbsp; →</a>
      <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#98a2b3;">If you did not create this account, please contact our support team.</p>
    </div>
    <div style="border-top:1px solid #f0edf7;padding:18px 32px;text-align:center;font-size:12px;color:#98a2b3;">%company_name% · Store account notification</div>
  </div>
</div>
HTML,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('email_templates')
            ->where('key', 'welcome_email')
            ->update([
                'subject' => 'Welcome to %company_name%',
                'body' => '<p>Dear %name%,</p><p>Welcome to <strong>%company_name%</strong>! Your company account has been created successfully.</p><p><strong>Email:</strong> %email%</p><p><strong>Phone:</strong> %phone%</p><p>You can log in here: <a href="%login_url%">%login_url%</a></p>',
                'updated_at' => now(),
            ]);
    }
};
