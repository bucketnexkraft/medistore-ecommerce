<?php

namespace App\Support;

use App\Models\Company;
use Illuminate\Support\Facades\Config;

class CompanyBroadcastConfig
{
    public static function apply(?Company $company): void
    {
        if ($company && self::hasCredentials($company)) {
            Config::set('broadcasting.default', 'pusher');
            Config::set('broadcasting.connections.pusher.key', (string) $company->pusher_app_key);
            Config::set('broadcasting.connections.pusher.secret', (string) $company->pusher_app_secret);
            Config::set('broadcasting.connections.pusher.app_id', (string) $company->pusher_app_id);
            Config::set('broadcasting.connections.pusher.options.cluster', (string) ($company->pusher_app_cluster ?: 'mt1'));

            return;
        }

        $extension = settings('extension');

        if (is_object($extension) && ! empty($extension->pusher_app_key) && ! empty($extension->pusher_app_secret) && ! empty($extension->pusher_app_id)) {
            Config::set('broadcasting.default', 'pusher');
            Config::set('broadcasting.connections.pusher.key', (string) $extension->pusher_app_key);
            Config::set('broadcasting.connections.pusher.secret', (string) $extension->pusher_app_secret);
            Config::set('broadcasting.connections.pusher.app_id', (string) $extension->pusher_app_id);
            Config::set('broadcasting.connections.pusher.options.cluster', (string) ($extension->pusher_app_cluster ?? 'mt1'));
        }
    }

    public static function publicConfig(?Company $company): ?array
    {
        if ($company && self::hasCredentials($company) && (bool) $company->push_status) {
            return [
                'enabled' => true,
                'key' => (string) $company->pusher_app_key,
                'cluster' => (string) ($company->pusher_app_cluster ?: 'mt1'),
            ];
        }

        $extension = settings('extension');
        $pushStatus = (bool) ($extension->push_status ?? false);

        if (is_object($extension) && $pushStatus && ! empty($extension->pusher_app_key)) {
            return [
                'enabled' => true,
                'key' => (string) $extension->pusher_app_key,
                'cluster' => (string) ($extension->pusher_app_cluster ?? 'mt1'),
            ];
        }

        return null;
    }

    private static function hasCredentials(Company $company): bool
    {
        return ! empty($company->pusher_app_key)
            && ! empty($company->pusher_app_secret)
            && ! empty($company->pusher_app_id);
    }
}
