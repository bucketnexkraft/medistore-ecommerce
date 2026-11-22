<?php

namespace App\Jobs;

use App\Services\DynamicMailService;
use App\Services\EmailTemplateService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPasswordResetCodeEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $code,
        public int $expiryMinutes
    ) {
    }

    public function handle(DynamicMailService $dynamicMailService, EmailTemplateService $templateService): void
    {
        $subject = 'Password Reset Verification Code';
        $htmlBody = "<p>Your password reset verification code is: <strong>{$this->code}</strong>.</p>"
            . "<p>It will expire in {$this->expiryMinutes} minutes.</p>";

        $template = $templateService->getActiveTemplateByKey('password_reset');

        if ($template) {
            $rendered = $templateService->renderTemplate($template, [
                'name' => $this->recipientName,
                'otp' => $this->code,
                'code' => $this->code,
                'expiry_minutes' => $this->expiryMinutes,
            ]);

            $subject = $rendered['subject'] ?: $subject;
            $htmlBody = $rendered['body'] ?: $htmlBody;
        }

        $sent = $dynamicMailService->sendHtml(
            $this->recipientEmail,
            $subject,
            $htmlBody
        );

        if (!$sent) {
            throw new \RuntimeException('Failed to send password reset verification email.');
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Password reset verification email job failed.', [
            'recipient_email' => $this->recipientEmail,
            'error' => $exception->getMessage(),
        ]);
    }
}
