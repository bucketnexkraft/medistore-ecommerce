<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Illuminate\Mail\Message;

class DynamicMailService
{
    public function getEmailConfiguration(): array
    {
        $rawValue = Setting::query()->where('key', 'email_configuration')->value('value');
        $decoded = json_decode((string) $rawValue, true);

        return is_array($decoded) ? $decoded : [];
    }

    public function sendHtml(string $toEmail, string $subject, string $htmlBody): bool
    {
        $emailConfig = $this->getEmailConfiguration();
        $method = strtolower((string) ($emailConfig['email_method'] ?? 'php'));

        if ($method === 'php') {
            return $this->sendByPhpMail($toEmail, $subject, $htmlBody, $emailConfig);
        }

        $this->applyDynamicMailConfig($emailConfig);

        Mail::html($htmlBody, function ($message) use ($toEmail, $subject) {
            $message
                ->to($toEmail)
                ->subject($subject);
        });

        return true;
    }

    public function sendHtmlWithAttachment(
        string $toEmail,
        string $subject,
        string $htmlBody,
        string $attachmentBinary,
        string $attachmentName,
        string $mime = 'application/pdf'
    ): bool {
        $emailConfig = $this->getEmailConfiguration();
        $method = strtolower((string) ($emailConfig['email_method'] ?? 'php'));

        // php mail fallback in this project does not support attachment easily
        // use dynamic transport for attachment sending.
        if ($method === 'php') {
            $this->applyDynamicMailConfig($emailConfig);
        } else {
            $this->applyDynamicMailConfig($emailConfig);
        }

        Mail::html($htmlBody, function (Message $message) use ($toEmail, $subject, $attachmentBinary, $attachmentName, $mime) {
            $message
                ->to($toEmail)
                ->subject($subject)
                ->attachData($attachmentBinary, $attachmentName, ['mime' => $mime]);
        });

        return true;
    }

    public function applyDynamicMailConfig(array $emailConfig): void
    {
        $method = strtolower((string) ($emailConfig['email_method'] ?? 'php'));
        $fromAddress = (string) ($emailConfig['email_send_from'] ?? config('mail.from.address'));

        Config::set('mail.from.address', $fromAddress);
        Config::set('mail.from.name', (string) (config('app.name') ?? 'stoqio'));

        if ($method === 'smtp') {
            Config::set('mail.mailers.dynamic_smtp', [
                'transport' => 'smtp',
                'host' => (string) ($emailConfig['smtp_host'] ?? ''),
                'port' => (int) ($emailConfig['smtp_port'] ?? 587),
                'encryption' => $emailConfig['smtp_encryption'] ?? 'tls',
                'username' => (string) ($emailConfig['smtp_username'] ?? ''),
                'password' => (string) ($emailConfig['smtp_password'] ?? ''),
                'timeout' => null,
                'local_domain' => env('MAIL_EHLO_DOMAIN'),
            ]);
            Config::set('mail.default', 'dynamic_smtp');

            return;
        }

        if ($method === 'sendgrid') {
            Config::set('mail.mailers.dynamic_sendgrid', [
                'transport' => 'smtp',
                'host' => 'smtp.sendgrid.net',
                'port' => 587,
                'encryption' => 'tls',
                'username' => 'apikey',
                'password' => (string) ($emailConfig['sendgrid_api_key'] ?? ''),
                'timeout' => null,
                'local_domain' => env('MAIL_EHLO_DOMAIN'),
            ]);
            Config::set('mail.default', 'dynamic_sendgrid');
        }
    }

    private function sendByPhpMail(string $toEmail, string $subject, string $htmlBody, array $emailConfig): bool
    {
        $fromAddress = (string) ($emailConfig['email_send_from'] ?? config('mail.from.address') ?? env('MAIL_FROM_ADDRESS'));

        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type:text/html;charset=UTF-8\r\n";
        if ($fromAddress !== '') {
            $headers .= "From: {$fromAddress}\r\n";
        }

        return mail($toEmail, $subject, $htmlBody, $headers);
    }
}
