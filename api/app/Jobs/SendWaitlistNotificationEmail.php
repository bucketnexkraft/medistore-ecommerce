<?php

namespace App\Jobs;

use App\Services\DynamicMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendWaitlistNotificationEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $subject,
        public string $messageBody
    ) {
    }

    public function handle(DynamicMailService $dynamicMailService): void
    {
        $htmlBody = view('mails.default', [
            'data' => [
                'subject' => $this->subject,
                'body' => $this->messageBody,
            ],
        ])->render();

        $sent = $dynamicMailService->sendHtml(
            $this->recipientEmail,
            $this->subject,
            $htmlBody
        );

        if (!$sent) {
            throw new \RuntimeException('Failed to send waitlist notification email.');
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Waitlist notification email job failed.', [
            'recipient_email' => $this->recipientEmail,
            'subject' => $this->subject,
            'error' => $exception->getMessage(),
        ]);
    }
}

