<?php

namespace App\Jobs;

use App\Services\DynamicMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendStoreSetupCompletedEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $companyName,
        public string $loginUrl,
        public string $templateName,
        public ?string $planName = null,
        public ?string $planBillingPeriod = null,
        public ?float $planPrice = null,
        public ?string $password = null
    ) {
    }

    public function handle(DynamicMailService $dynamicMailService): void
    {
        $subject = sprintf('Your store setup is complete - %s', $this->companyName);
        $planName = trim((string) $this->planName);
        $planBillingPeriod = trim((string) $this->planBillingPeriod);
        $planPrice = $this->planPrice !== null ? number_format($this->planPrice, 2) : '0.00';
        $passwordText = trim((string) ($this->password ?? ''));
        $passwordLine = $passwordText !== ''
            ? $passwordText
            : 'Use the password you created during signup.';

        $htmlBody = view('mails.default', [
            'data' => sprintf(
                '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">'
                . '<p>Dear %s,</p>'
                . '<p>Your store setup for <strong>%s</strong> is now complete.</p>'
                . '<p><strong>Login URL:</strong> <a href="%s">%s</a></p>'
                . '<p><strong>Email:</strong> %s</p>'
                . '<p><strong>Password:</strong> %s</p>'
                . '<p><strong>Selected Template:</strong> %s</p>'
                . '<p><strong>Plan:</strong> %s%s</p>'
                . '<p><strong>Plan Price:</strong> %s</p>'
                . '</div>',
                e($this->recipientName ?: $this->companyName),
                e($this->companyName),
                e($this->loginUrl),
                e($this->loginUrl),
                e($this->recipientEmail),
                e($passwordLine),
                e($this->templateName),
                e($planName !== '' ? $planName : 'N/A'),
                $planBillingPeriod !== '' ? ' (' . e($planBillingPeriod) . ')' : '',
                e($planPrice)
            ),
        ])->render();

        $sent = $dynamicMailService->sendHtml(
            $this->recipientEmail,
            $subject,
            $htmlBody
        );

        if (! $sent) {
            throw new \RuntimeException('Failed to send store setup completion email.');
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Store setup completion email job failed.', [
            'recipient_email' => $this->recipientEmail,
            'company_name' => $this->companyName,
            'error' => $exception->getMessage(),
        ]);
    }
}
