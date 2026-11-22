<?php

namespace App\Services;

use App\Models\EmailTemplate;

class EmailTemplateService
{
    public function getActiveTemplateByKey(string $key): ?EmailTemplate
    {
        return EmailTemplate::query()
            ->where('key', $key)
            ->where('status', true)
            ->first();
    }

    public function renderTemplate(EmailTemplate $template, array $variables): array
    {
        return [
            'subject' => $this->replacePlaceholders((string) $template->subject, $variables),
            'body' => $this->replacePlaceholders((string) $template->body, $variables),
        ];
    }

    private function replacePlaceholders(string $content, array $variables): string
    {
        $replacements = [];

        foreach ($variables as $key => $value) {
            if (is_scalar($value) || $value === null) {
                $replacements['%' . $key . '%'] = (string) ($value ?? '');
            }
        }

        return strtr($content, $replacements);
    }
}
