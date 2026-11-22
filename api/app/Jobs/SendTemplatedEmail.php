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

class SendTemplatedEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public string $recipientEmail,
        public string $templateKey,
        public array $variables = []
    ) {
    }

    public function handle(EmailTemplateService $templateService, DynamicMailService $dynamicMailService): void
    {
        $template = $templateService->getActiveTemplateByKey($this->templateKey);

        if (!$template) {
            Log::warning('Email template not found or inactive.', [
                'template_key' => $this->templateKey,
                'recipient_email' => $this->recipientEmail,
            ]);

            return;
        }

        $rendered = $templateService->renderTemplate($template, $this->variables);

        $sent = $dynamicMailService->sendHtml(
            $this->recipientEmail,
            $rendered['subject'],
            $rendered['body']
        );

        if (!$sent) {
            throw new \RuntimeException('Failed to send templated email using configured mail method.');
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('Queued templated email failed.', [
            'template_key' => $this->templateKey,
            'recipient_email' => $this->recipientEmail,
            'error' => $exception->getMessage(),
        ]);
    }
}
