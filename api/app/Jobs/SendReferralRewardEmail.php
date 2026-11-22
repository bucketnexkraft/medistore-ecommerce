<?php

namespace App\Jobs;

use App\Services\DynamicMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendReferralRewardEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $referredCompanyName,
        public string $referredCompanyCode,
        public int $level,
        public float $amount,
        public string $rewardType,
        public string $dashboardUrl
    ) {
    }

    public function handle(DynamicMailService $dynamicMailService): void
    {
        $subject = sprintf(
            'Referral bonus earned from %s',
            $this->referredCompanyName
        );

        $htmlBody = view('mails.default', [
            'data' => sprintf(
                '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">'
                . '<p>Dear %s,</p>'
                . '<p>A new referral has been successfully added to your network.</p>'
                . '<p><strong>Referred company:</strong> %s</p>'
                . '<p><strong>Referral code:</strong> %s</p>'
                . '<p><strong>Reward type:</strong> %s</p>'
                . '<p><strong>Level:</strong> %d</p>'
                . '<p><strong>Bonus amount:</strong> %s</p>'
                . '<p>You can review your referral dashboard here: <a href="%s">%s</a></p>'
                . '</div>',
                e($this->recipientName),
                e($this->referredCompanyName),
                e($this->referredCompanyCode ?: 'N/A'),
                e($this->rewardType),
                $this->level,
                e(number_format($this->amount, 2)),
                e($this->dashboardUrl),
                e($this->dashboardUrl)
            ),
        ])->render();

        $sent = $dynamicMailService->sendHtml(
            $this->recipientEmail,
            $subject,
            $htmlBody
        );

        if (! $sent) {
            throw new \RuntimeException('Failed to send referral reward email.');
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Referral reward email job failed.', [
            'recipient_email' => $this->recipientEmail,
            'referred_company_name' => $this->referredCompanyName,
            'error' => $exception->getMessage(),
        ]);
    }
}
